import { DadosCriacaoVinculo, Vinculo } from '../vinculos.types.js'

export interface VinculoRepository {
    criar(dados: DadosCriacaoVinculo): Promise<Vinculo>
    buscarPorId(id: string): Promise<Vinculo | null>
    buscarEntreProfissionalEAluno(profissionalId: string, alunoId: string): Promise<Vinculo[]>
    atualizar(vinculo: Vinculo): Promise<Vinculo | null>
}
