import { promises as fs } from 'node:fs'
import { ConfiguracaoAtividade } from '../configuracoes-atividades.types.js'
import { ConfiguracaoRepository } from './configuracao.repository.js'

export class JsonConfiguracaoRepository implements ConfiguracaoRepository {
    private gravacoesPendentes: Promise<void> = Promise.resolve()

    constructor(private readonly caminho: string) { }

    async listar(): Promise<ConfiguracaoAtividade[]> {
        return JSON.parse(await fs.readFile(this.caminho, 'utf-8'))
    }

    async buscarPorId(id: string): Promise<ConfiguracaoAtividade | null> {
        return (await this.listar()).find((item) => item.id === id) ?? null
    }

    async criar(configuracao: ConfiguracaoAtividade): Promise<void> {
        const gravacao = this.gravacoesPendentes.then(async () => {
            const configuracoes = await this.listar()
            configuracoes.push(configuracao)
            const temporario = `${this.caminho}.tmp`
            try {
                await fs.writeFile(temporario, JSON.stringify(configuracoes, null, 2) + '\n')
                await fs.rename(temporario, this.caminho)
            } finally {
                await fs.rm(temporario, { force: true })
            }
        })
        this.gravacoesPendentes = gravacao.catch(() => undefined)
        return gravacao
    }
}
