import { ModalidadeRepository } from './repositories/modalidade.repository.js'
import { ModalidadeNaoEncontradaError } from './modalidades.errors.js'
import { DefinirModalidadesBody } from './modalidades.schema.js'
import { Modalidade } from './modalidades.types.js'

export class ModalidadeService {
    constructor(private readonly modalidadeRepository: ModalidadeRepository) { }

    async listarCatalogo(): Promise<Modalidade[]> {
        const modalidades = await this.modalidadeRepository.listarCatalogo()
        return modalidades.map(({ id, nome }) => ({ id, nome }))
    }

    async listarMinhasModalidades(profissionalId: string): Promise<Modalidade[]> {
        const modalidadeIds = await this.modalidadeRepository.buscarIdsPorProfissional(profissionalId)
        const catalogo = await this.listarCatalogo()
        return catalogo.filter((modalidade) => modalidadeIds.includes(modalidade.id))
    }

    async definirModalidades(profissionalId: string, dados: DefinirModalidadesBody): Promise<Modalidade[]> {
        const catalogo = await this.listarCatalogo()

        if (dados.modalidadeIds.some((id) => !catalogo.some((modalidade) => modalidade.id === id))) {
            throw new ModalidadeNaoEncontradaError()
        }

        const modalidades = catalogo.filter((modalidade) => dados.modalidadeIds.includes(modalidade.id))
        await this.modalidadeRepository.substituirSelecao(profissionalId, modalidades.map((modalidade) => modalidade.id))
        return modalidades
    }
}
