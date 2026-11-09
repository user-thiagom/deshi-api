
import { promises as fs } from 'node:fs'
import { Programa } from '../programas.types.js'
import { ProgramaRepository } from './programa.repository.js'

export class JsonProgramaRepository implements ProgramaRepository {
    private gravacoesPendentes: Promise<void> = Promise.resolve()

    constructor(private readonly caminho: string) {}

    async listar(): Promise<Programa[]> {
        const conteudo = await fs.readFile(this.caminho, 'utf-8')
        return JSON.parse(conteudo) as Programa[]
    }

    async criar(programa: Programa): Promise<void> {
        const gravacao = this.gravacoesPendentes.then(async () => {
            const programas = await this.listar()
            programas.push(programa)

            const temporario = `${this.caminho}.tmp`
            try {
                await fs.writeFile(
                    temporario,
                    JSON.stringify(programas, null, 2) + '\n'
                )
                await fs.rename(temporario, this.caminho)
            } finally {
                await fs.rm(temporario, { force: true })
            }
        })

        this.gravacoesPendentes = gravacao.catch(() => undefined)
        return gravacao
    }
}
