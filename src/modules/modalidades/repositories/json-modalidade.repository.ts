import { promises as fs } from 'node:fs'
import { Modalidade, SelecaoModalidades } from '../modalidades.types.js'
import { ModalidadeRepository } from './modalidade.repository.js'

export class JsonModalidadeRepository implements ModalidadeRepository {
    private gravacoesPendentes: Promise<void> = Promise.resolve()

    constructor(
        private readonly caminhoCatalogo: string,
        private readonly caminhoSelecoes: string
    ) { }

    async listarCatalogo(): Promise<Modalidade[]> {
        const conteudo = await fs.readFile(this.caminhoCatalogo, 'utf-8')
        return JSON.parse(conteudo)
    }

    private async lerSelecoes(): Promise<SelecaoModalidades[]> {
        const conteudo = await fs.readFile(this.caminhoSelecoes, 'utf-8')
        return JSON.parse(conteudo)
    }

    async buscarIdsPorProfissional(profissionalId: string): Promise<string[]> {
        const selecoes = await this.lerSelecoes()
        return selecoes.find((selecao) => selecao.profissionalId === profissionalId)?.modalidadeIds ?? []
    }

    async substituirSelecao(profissionalId: string, modalidadeIds: string[]): Promise<void> {
        // Serializa gravações nesta instância para preservar seleções de outros profissionais.
        const gravacao = this.gravacoesPendentes.then(async () => {
            const selecoes = await this.lerSelecoes()
            const atualizadas = selecoes.filter((selecao) => selecao.profissionalId !== profissionalId)
            atualizadas.push({ profissionalId, modalidadeIds })

            const caminhoTemporario = `${this.caminhoSelecoes}.tmp`
            try {
                await fs.writeFile(caminhoTemporario, JSON.stringify(atualizadas, null, 2))
                await fs.rename(caminhoTemporario, this.caminhoSelecoes)
            } finally {
                await fs.rm(caminhoTemporario, { force: true })
            }
        })

        this.gravacoesPendentes = gravacao.catch(() => undefined)
        return gravacao
    }
}
