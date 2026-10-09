import type { Program } from '../programs.types.js'

export interface ProgramRepository {
    findById(id: string): Promise<Program | null>
    findByStudentId(studentId: string): Promise<Program[]>
}