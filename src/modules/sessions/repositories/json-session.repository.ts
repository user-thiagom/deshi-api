import { promises as fs } from 'node:fs'

import type { Session } from '../sessions.types.js'
import type { SessionRepository } from './session.repository.js'

export class JsonSessionRepository implements SessionRepository {
    constructor(private readonly filePath: string) {}

    private async readSessions(): Promise<Session[]> {
        const content = await fs.readFile(this.filePath, 'utf-8')
        const sessions = JSON.parse(content) as Session[]

        return sessions.map((session) => ({
            ...session,
            startedAt: new Date(session.startedAt)
        }))
    }

    private async writeSessions(sessions: Session[]): Promise<void> {
        const data = JSON.stringify(sessions, null, 2)

        await fs.writeFile(this.filePath, data)
    }

    async create(session: Session): Promise<Session> {
        const sessions = await this.readSessions()

        sessions.push(session)

        await this.writeSessions(sessions)

        return session
    }

    async findById(id: string): Promise<Session | null> {
        const sessions = await this.readSessions()

        return sessions.find((session) => session.id === id) ?? null
    }

    async findByStudentId(studentId: string): Promise<Session[]> {
        const sessions = await this.readSessions()

        return sessions.filter(
            (session) => session.studentId === studentId
        )
    }
}