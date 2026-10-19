import { CreateProgramData, Program } from '../program.types.js'

export interface ProgramRepository {
    create(data: CreateProgramData): Promise<Program>
}