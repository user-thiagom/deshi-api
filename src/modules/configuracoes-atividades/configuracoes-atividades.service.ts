import { randomUUID } from 'node:crypto'
import { AtividadeRepository } from '../atividades/repositories/atividade.repository.js'
import { CamposRepository } from './repositories/campos.repository.js'
import { ConfiguracaoRepository } from './repositories/configuracao.repository.js'
import { CamposAtividade, ConfiguracaoAtividade, METRICAS } from './configuracoes-atividades.types.js'
import { ConfiguracaoError } from './configuracoes-atividades.errors.js'
import { CriarConfiguracaoBody, DefinirCamposBody, definirCamposSchema } from './configuracoes-atividades.schema.js'

export class ConfiguracaoAtividadeService {
    constructor(
        private readonly atividades: Pick<AtividadeRepository, 'listar'>,
        private readonly campos: CamposRepository,
        private readonly configuracoes: ConfiguracaoRepository
    ) { }

    private async atividadeAcessivel(atividadeId: string, profissionalId: string) {
        const atividade = (await this.atividades.listar()).find((item) => item.id === atividadeId)
        if (!atividade || (atividade.origem !== 'PADRAO' && atividade.profissionalId !== profissionalId)) {
            throw new ConfiguracaoError(404, 'Atividade não encontrada.')
        }
        return atividade
    }

    async consultarCampos(atividadeId: string, profissionalId: string): Promise<CamposAtividade> {
        await this.atividadeAcessivel(atividadeId, profissionalId)
        const definicao = await this.campos.buscarPorAtividade(atividadeId)
        if (!definicao) {
            throw new ConfiguracaoError(409, 'Defina os campos da atividade antes de configurá-la.')
        }
        // Valida também o catálogo armazenado; JSON nunca contém código executável.
        const { campos } = definirCamposSchema.parse({ campos: definicao.campos })
        return { atividadeId, campos }
    }

    async definirCampos(atividadeId: string, profissionalId: string, dados: DefinirCamposBody): Promise<CamposAtividade> {
        const atividade = await this.atividadeAcessivel(atividadeId, profissionalId)
        if (atividade.origem === 'PADRAO') {
            throw new ConfiguracaoError(403, 'Os campos de atividades padrão são definidos pelo sistema.')
        }
        const resultado = definirCamposSchema.safeParse(dados)
        if (!resultado.success) throw new ConfiguracaoError(400, 'Definição de campos inválida.')
        const definicao = { atividadeId, campos: resultado.data.campos }
        await this.campos.criarPersonalizada(definicao)
        return definicao
    }

    async criar(atividadeId: string, profissionalId: string, dados: CriarConfiguracaoBody): Promise<ConfiguracaoAtividade> {
        const { campos } = await this.consultarCampos(atividadeId, profissionalId)
        const permitidos = new Set(campos.map((campo) => campo.chave))
        for (const chave of Object.keys(dados.valores)) {
            if (!permitidos.has(chave as typeof campos[number]['chave'])) {
                throw new ConfiguracaoError(400, `Parâmetro não permitido: ${chave}.`)
            }
        }
        for (const campo of campos) {
            const presente = Object.hasOwn(dados.valores, campo.chave)
            if (!presente) {
                if (campo.obrigatorio) throw new ConfiguracaoError(400, `Parâmetro obrigatório: ${campo.chave}.`)
                continue
            }
            const valor = dados.valores[campo.chave]
            if (typeof valor !== 'number' || !Number.isFinite(valor) ||
                (campo.tipo !== 'decimal' && !Number.isSafeInteger(valor))) {
                throw new ConfiguracaoError(400, `Tipo inválido: ${campo.chave}.`)
            }
            if (valor < (campo.min ?? METRICAS[campo.chave].min) ||
                (campo.max !== undefined && valor > campo.max)) {
                throw new ConfiguracaoError(400, `Valor fora dos limites: ${campo.chave}.`)
            }
        }
        const agora = new Date().toISOString()
        const configuracao: ConfiguracaoAtividade = {
            id: randomUUID(), atividadeId, profissionalId,
            valores: { ...dados.valores }, criadoEm: agora, atualizadoEm: agora
        }
        await this.configuracoes.criar(configuracao)
        return configuracao
    }

    async buscarPorId(id: string, profissionalId: string): Promise<ConfiguracaoAtividade> {
        const configuracao = await this.configuracoes.buscarPorId(id)
        if (!configuracao || configuracao.profissionalId !== profissionalId) {
            throw new ConfiguracaoError(404, 'Configuração não encontrada.')
        }
        return configuracao
    }
}
