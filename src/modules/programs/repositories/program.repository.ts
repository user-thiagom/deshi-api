import type { CreateProgramData, Program } from '../program.types.js'

export interface ProgramRepository {
  create(data: CreateProgramData): Promise<Program>
  findById(id: string): Promise<Program | null>
  findByStudentId(studentId: string): Promise<Program[]>
  findByProfessionalId?(professionalId: string): Promise<Program[]>
  update(program: Program): Promise<Program>
}