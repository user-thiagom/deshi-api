
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

    async buscarPorId(id: string): Promise<Programa | null> {
        const programas = await this.listar()
        return programas.find((programa) => programa.id === id) ?? null
    }

    private enfileirarGravacao(
        operacao: (programas: Programa[]) => Promise<void>
    ): Promise<void> {
        const gravacao = this.gravacoesPendentes.then(async () => {
            const programas = await this.listar()
            await operacao(programas)

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

    async criar(programa: Programa): Promise<void> {
        return this.enfileirarGravacao(async (programas) => {
            programas.push(programa)
        })
    }

    async atualizar(programaAtualizado: Programa): Promise<void> {
        return this.enfileirarGravacao(async (programas) => {
            const indice = programas.findIndex(
                (programa) => programa.id === programaAtualizado.id
            )

            if (indice === -1) {
                throw new Error('Programa não encontrado para atualização.')
            }

            programas[indice] = programaAtualizado
        })
    }
}
