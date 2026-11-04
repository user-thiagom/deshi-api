import type { CreateProgramData, Program } from '../program.types.js'

export interface ProgramRepository {
  create(data: CreateProgramData): Promise<Program>
  findById(id: string): Promise<Program | null>
  findByStudentId(studentId: string): Promise<Program[]>
}