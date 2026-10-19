
import { Convite, DadosCriacaoConvite } from '../convite.types.js'

export interface ConviteRepository {
    criar(dados: DadosCriacaoConvite): Promise<Convite>
    buscarPorCodigo(codigo: string): Promise<Convite | null>
    buscarPendenteEntreProfissionalEAluno(profissionalId: string, alunoId: string): Promise<Convite | null>
    atualizar(convite: Convite): Promise<Convite | null>
}
