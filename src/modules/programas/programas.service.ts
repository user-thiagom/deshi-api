
import { randomUUID } from 'node:crypto'
import { AtividadeRepository } from '../atividades/repositories/atividade.repository.js'
import { ModalidadeRepository } from '../modalidades/repositories/modalidade.repository.js'
import { VinculoRepository } from '../vinculos/repositories/vinculo.repository.js'
import { CamposRepository } from '../configuracoes-atividades/repositories/campos.repository.js'
import { ProgramaRepository } from './repositories/programa.repository.js'
import { ProgramaError } from './programas.errors.js'
import { CriarProgramaBody } from './programas.schema.js'
import { Programa } from './programas.types.js'

export class ProgramaService {
    constructor(
        private readonly programas: ProgramaRepository,
        private readonly vinculos: Pick<VinculoRepository, 'buscarEntreProfissionalEAluno'>,
        private readonly atividades: Pick<AtividadeRepository, 'listar'>,
        private readonly modalidades: Pick<ModalidadeRepository, 'buscarIdsPorProfissional'>,
        private readonly campos: CamposRepository
    ) {}

    
async criar(
    profissionalId: string,
    dados: CriarProgramaBody
): Promise<Programa> {
    const vinculos = await this.vinculos.buscarEntreProfissionalEAluno(
        profissionalId,
        dados.alunoId
    )

    if (!vinculos.some((vinculo) => vinculo.status === 'ATIVO')) {
        throw new ProgramaError(403, 'O aluno não possui vínculo ativo com este profissional.')
    }

    const modalidadesIds = await this.modalidades.buscarIdsPorProfissional(profissionalId)

    if (!modalidadesIds.includes(dados.modalidadeId)) {
        throw new ProgramaError(403, 'O profissional não selecionou esta modalidade.')
    }

    const atividadesDisponiveis = await this.atividades.listar()
    const atividadesSelecionadas = []

    for (const item of dados.atividades) {
        const atividade = atividadesDisponiveis.find(
            (candidata) => candidata.id === item.atividadeId
        )

        if (
            !atividade ||
            (atividade.origem === 'PERSONALIZADA' &&
                atividade.profissionalId !== profissionalId)
        ) {
            throw new ProgramaError(404, 'Atividade não encontrada.')
        }

        if (atividade.modalidadeId !== dados.modalidadeId) {
            throw new ProgramaError(
                400,
                'Todas as atividades devem pertencer à modalidade escolhida.'
            )
        }

        atividadesSelecionadas.push({ item, atividade })
    }

    
const agora = new Date().toISOString()

for (const { item, atividade } of atividadesSelecionadas) {
    const definicao = await this.campos.buscarPorAtividade(atividade.id)

    if (!definicao) {
        throw new ProgramaError(
            409,
            `Os campos da atividade "${atividade.nome}" ainda não foram definidos.`
        )
    }

    const permitidos = new Set(definicao.campos.map((campo) => campo.chave))

    for (const chave of Object.keys(item.valores)) {
        if (!permitidos.has(chave as typeof definicao.campos[number]['chave'])) {
            throw new ProgramaError(400, `Parâmetro não permitido: ${chave}.`)
        }
    }

    for (const campo of definicao.campos) {
        const presente = Object.hasOwn(item.valores, campo.chave)

        if (!presente) {
            if (campo.obrigatorio) {
                throw new ProgramaError(400, `Parâmetro obrigatório: ${campo.chave}.`)
            }
            continue
        }

        const valor = item.valores[campo.chave]

        if (
            typeof valor !== 'number' ||
            !Number.isFinite(valor) ||
            (campo.tipo !== 'decimal' && !Number.isSafeInteger(valor))
        ) {
            throw new ProgramaError(400, `Tipo inválido: ${campo.chave}.`)
        }

        if (
            valor < (campo.min ?? 0) ||
            (campo.max !== undefined && valor > campo.max)
        ) {
            throw new ProgramaError(400, `Valor fora dos limites: ${campo.chave}.`)
        }
    }
}

const programa: Programa = {
    id: randomUUID(),
    profissionalId,
    alunoId: dados.alunoId,
    modalidadeId: dados.modalidadeId,
    nome: dados.nome,
    atividades: dados.atividades
        .map((item) => ({
            atividadeId: item.atividadeId,
            ordem: item.ordem,
            valores: { ...item.valores }
        }))
        .sort((a, b) => a.ordem - b.ordem),
    criadoEm: agora,
    atualizadoEm: agora
}

await this.programas.criar(programa)

return programa

}

}
