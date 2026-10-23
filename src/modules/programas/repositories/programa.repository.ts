
import { Programa } from '../programas.types.js'

export interface ProgramaRepository {
    listar(): Promise<Programa[]>
    criar(programa: Programa): Promise<void>
}
