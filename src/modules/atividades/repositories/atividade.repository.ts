import { Atividade } from '../atividades.types.js'

export interface AtividadeRepository {
    listar(): Promise<Atividade[]>
    criar(atividade: Atividade): Promise<void>
}
