import { Modalidade } from '../modalidades.types.js'

export interface ModalidadeRepository {
    listarCatalogo(): Promise<Modalidade[]>
    buscarIdsPorProfissional(profissionalId: string): Promise<string[]>
    substituirSelecao(profissionalId: string, modalidadeIds: string[]): Promise<void>
}
