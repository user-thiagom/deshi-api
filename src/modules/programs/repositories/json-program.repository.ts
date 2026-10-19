import { promises as fs } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { CreateProgramData, Program } from '../program.types.js'
import { ProgramRepository } from './program.repository.js'

export class JsonProgramRepository implements ProgramRepository {
    constructor(private readonly filePath: string) { }

    private async readPrograms(): Promise<Program[]> {
        const content = await fs.readFile(this.filePath, 'utf-8')
        return JSON.parse(content) as Program[]
    }

    async create(data: CreateProgramData): Promise<Program> {
        const program: Program = {
            id: randomUUID(),
            ...data,
            activities: data.activities.map((activity) => ({ ...activity })),
            createdAt: new Date()
        }
        const programs = await this.readPrograms()
        programs.push(program)
        await fs.writeFile(this.filePath, JSON.stringify(programs, null, 2))
        return program
    }
}