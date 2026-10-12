import { promises as fs } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { VinculoRepository } from './vinculo.repository.js'
import { DadosCriacaoVinculo, Vinculo } from '../vinculos.types.js'

export class JsonVinculoRepository implements VinculoRepository {
    constructor(private readonly filePath: string) { }

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
        await fs.writeFile(this.filePath, JSON.stringify(vinculos, null, 2))
    }

    async criar(dados: DadosCriacaoVinculo): Promise<Vinculo> {
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
    }

    async buscarPorId(id: string): Promise<Vinculo | null> {
        const vinculos = await this.lerVinculos()
        return vinculos.find((vinculo) => vinculo.id === id) ?? null
    }

    async buscarEntreProfissionalEAluno(profissionalId: string, alunoId: string): Promise<Vinculo[]> {
        const vinculos = await this.lerVinculos()
        return vinculos.filter((vinculo) =>
            vinculo.profissionalId === profissionalId && vinculo.alunoId === alunoId
        )
    }

    async atualizar(vinculo: Vinculo): Promise<Vinculo | null> {
        const vinculos = await this.lerVinculos()
        const indice = vinculos.findIndex((registro) => registro.id === vinculo.id)

        if (indice === -1) {
            return null
        }

        vinculos[indice] = vinculo
        await this.escreverVinculos(vinculos)

        return vinculo
    }
}
