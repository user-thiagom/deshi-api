import { promises as fs } from 'node:fs'
import { CamposAtividade } from '../configuracoes-atividades.types.js'
import { ConfiguracaoError } from '../configuracoes-atividades.errors.js'
import { CamposRepository } from './campos.repository.js'

export class JsonCamposRepository implements CamposRepository {
    private gravacoesPendentes: Promise<void> = Promise.resolve()

    constructor(
        private readonly caminhoCatalogo: string,
        private readonly caminhoPersonalizadas: string
    ) { }

    private async lerPersonalizadas(): Promise<CamposAtividade[]> {
        return JSON.parse(await fs.readFile(this.caminhoPersonalizadas, 'utf-8'))
    }

    async buscarPorAtividade(atividadeId: string): Promise<CamposAtividade | null> {
        const catalogo: CamposAtividade[] = JSON.parse(await fs.readFile(this.caminhoCatalogo, 'utf-8'))
        const padrao = catalogo.find((item) => item.atividadeId === atividadeId)
        if (padrao) return padrao
        return (await this.lerPersonalizadas()).find((item) => item.atividadeId === atividadeId) ?? null
    }

    async criarPersonalizada(definicao: CamposAtividade): Promise<void> {
        const gravacao = this.gravacoesPendentes.then(async () => {
            const definicoes = await this.lerPersonalizadas()
            // A checagem na fila impede duas definições concorrentes para o mesmo ID.
            if (definicoes.some((item) => item.atividadeId === definicao.atividadeId)) {
                throw new ConfiguracaoError(409, 'Os campos desta atividade já foram definidos.')
            }
            definicoes.push(definicao)
            const temporario = `${this.caminhoPersonalizadas}.tmp`
            try {
                await fs.writeFile(temporario, JSON.stringify(definicoes, null, 2) + '\n')
                await fs.rename(temporario, this.caminhoPersonalizadas)
            } finally {
                await fs.rm(temporario, { force: true })
            }
        })
        this.gravacoesPendentes = gravacao.catch(() => undefined)
        return gravacao
    }
}
