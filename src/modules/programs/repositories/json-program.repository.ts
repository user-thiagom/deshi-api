
import { promises as fs } from 'node:fs'

import type { Program } from '../programs.types.js'
import type { ProgramRepository } from './program.repository.js'

export class JsonProgramRepository implements ProgramRepository {
    constructor(private readonly filePath: string) {}

    private async readPrograms(): Promise<Program[]> {
        const content = await fs.readFile(this.filePath, 'utf-8')

        return JSON.parse(content) as Program[]
    }

    async findById(id: string): Promise<Program | null> {
        const programs = await this.readPrograms()

        return programs.find((program) => program.id === id) ?? null
    }

    async findByStudentId(studentId: string): Promise<Program[]> {
        const programs = await this.readPrograms()

        return programs.filter(
            (program) => program.studentId === studentId
        )
    }
}