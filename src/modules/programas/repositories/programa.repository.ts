
import { Programa } from '../programas.types.js'

export interface ProgramaRepository {
    listar(): Promise<Programa[]>
    buscarPorId(id: string): Promise<Programa | null>
    criar(programa: Programa): Promise<void>
    atualizar(programa: Programa): Promise<void>
}

