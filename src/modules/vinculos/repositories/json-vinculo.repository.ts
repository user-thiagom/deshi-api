import { executarGravacaoJson } from '../vinculos.concorrencia.js'
import { promises as fs } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { VinculoRepository } from './vinculo.repository.js'
import { DadosCriacaoVinculo, Vinculo } from '../vinculos.types.js'

export class JsonVinculoRepository implements VinculoRepository {
    constructor(private readonly filePath: string) {}

    private executarEmSequencia<T>(
        operacao: () => Promise<T>
    ): Promise<T> {
        return executarGravacaoJson(this.filePath, operacao)
    }

    private async lerVinculos(): Promise<Vinculo[]> {
        const conteudo = await fs.readFile(this.filePath, 'utf-8')
        const vinculos: Vinculo[] = JSON.parse(conteudo)

        return vinculos.map((vinculo) => ({
            ...vinculo,
            criadoEm: new Date(vinculo.criadoEm),
            atualizadoEm: new Date(vinculo.atualizadoEm)
        }))
    }

    private async escreverVinculos(vinculos: Vinculo[]): Promise<void> {
        const arquivoTemporario = `${this.filePath}.${randomUUID()}.tmp`

        try {
            await fs.writeFile(
                arquivoTemporario,
                JSON.stringify(vinculos, null, 2),
                'utf-8'
            )

            await fs.rename(arquivoTemporario, this.filePath)
        } catch (erro) {
            await fs.unlink(arquivoTemporario).catch(() => undefined)
            throw erro
        }
    }

    async criar(dados: DadosCriacaoVinculo): Promise<Vinculo> {
        return this.executarEmSequencia(async () => {
            const agora = new Date()

            const vinculo: Vinculo = {
                id: randomUUID(),
                ...dados,
                criadoEm: agora,
                atualizadoEm: agora
            }

            const vinculos = await this.lerVinculos()
            vinculos.push(vinculo)

            await this.escreverVinculos(vinculos)

            return vinculo
        })
    }

    async buscarPorId(id: string): Promise<Vinculo | null> {
        const vinculos = await this.lerVinculos()
        return vinculos.find((vinculo) => vinculo.id === id) ?? null
    }

    async buscarAtivosPorProfissional(
        profissionalId: string
    ): Promise<Vinculo[]> {
        const vinculos = await this.lerVinculos()

        return vinculos.filter(
            (vinculo) =>
                vinculo.profissionalId === profissionalId &&
                vinculo.status === 'ATIVO'
        )
    }

    async buscarAtivosPorAluno(alunoId: string): Promise<Vinculo[]> {
        const vinculos = await this.lerVinculos()

        return vinculos.filter(
            (vinculo) =>
                vinculo.alunoId === alunoId &&
                vinculo.status === 'ATIVO'
        )
    }

    async buscarEntreProfissionalEAluno(
        profissionalId: string,
        alunoId: string
    ): Promise<Vinculo[]> {
        const vinculos = await this.lerVinculos()

        return vinculos.filter(
            (vinculo) =>
                vinculo.profissionalId === profissionalId &&
                vinculo.alunoId === alunoId
        )
    }

    async atualizar(vinculo: Vinculo): Promise<Vinculo | null> {
        return this.executarEmSequencia(async () => {
            const vinculos = await this.lerVinculos()

            const indice = vinculos.findIndex(
                (registro) => registro.id === vinculo.id
            )

            if (indice === -1) {
                return null
            }

            vinculos[indice] = {
                ...vinculo,
                atualizadoEm: new Date()
            }

            await this.escreverVinculos(vinculos)

            return vinculos[indice]
        })
    }

    async remover(id: string): Promise<boolean> {
        return this.executarEmSequencia(async () => {
            const vinculos = await this.lerVinculos()
            const indice = vinculos.findIndex(
                (vinculo) => vinculo.id === id
            )

            if (indice === -1) {
                return false
            }

            vinculos.splice(indice, 1)

            await this.escreverVinculos(vinculos)

            return true
        })
    }
}
