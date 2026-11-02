import { DadosCriacaoVinculo, Vinculo } from '../vinculos.types.js'

export interface VinculoRepository {
    criar(dados: DadosCriacaoVinculo): Promise<Vinculo>
    buscarPorId(id: string): Promise<Vinculo | null>
    buscarAtivosPorProfissional(profissionalId: string): Promise<Vinculo[]>
    buscarEntreProfissionalEAluno(profissionalId: string, alunoId: string): Promise<Vinculo[]>
    atualizar(vinculo: Vinculo): Promise<Vinculo | null>
}
