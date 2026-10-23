import { promises as fs } from 'node:fs'
import { Atividade } from '../atividades.types.js'
import { AtividadeRepository } from './atividade.repository.js'

export class JsonAtividadeRepository implements AtividadeRepository {
    private gravacoesPendentes: Promise<void> = Promise.resolve()

    constructor(
        private readonly caminhoCatalogo: string,
        private readonly caminhoPersonalizadas: string
    ) { }

    async listar(): Promise<Atividade[]> {
        const [catalogo, personalizadas] = await Promise.all([
            fs.readFile(this.caminhoCatalogo, 'utf-8'),
            this.lerPersonalizadas()
        ])
        return [...JSON.parse(catalogo), ...personalizadas]
    }

    private async lerPersonalizadas(): Promise<Atividade[]> {
        return JSON.parse(await fs.readFile(this.caminhoPersonalizadas, 'utf-8'))
    }

    async criar(atividade: Atividade): Promise<void> {
        // Serializa inclusões nesta instância para não perder atividades concorrentes.
        const gravacao = this.gravacoesPendentes.then(async () => {
            const atividades = await this.lerPersonalizadas()
            atividades.push(atividade)

            const temporario = `${this.caminhoPersonalizadas}.tmp`
            try {
                await fs.writeFile(temporario, JSON.stringify(atividades, null, 2) + '\n')
                await fs.rename(temporario, this.caminhoPersonalizadas)
            } finally {
                await fs.rm(temporario, { force: true })
            }
        })

        this.gravacoesPendentes = gravacao.catch(() => undefined)
        return gravacao
    }
}
