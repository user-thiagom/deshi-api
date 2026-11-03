import { promises as fs } from 'node:fs'

import type { Session } from '../sessions.types.js'
import type { SessionRepository } from './session.repository.js'

export class JsonSessionRepository implements SessionRepository {
    constructor(private readonly filePath: string) { }


    private async readSessions(): Promise<Session[]> {
        const content = await fs.readFile(this.filePath, 'utf-8')
        const sessions = JSON.parse(content) as Session[]

        return sessions.map((session) => ({
            ...session,
            startedAt: new Date(session.startedAt),

            activities: session.activities.map((activity) => {
                const tracking = activity.timeTracking

                if (!tracking) {
                    return activity
                }

                return {
                    ...activity,
                    timeTracking: {
                        ...tracking,

                        activeStartedAt: tracking.activeStartedAt
                            ? new Date(tracking.activeStartedAt)
                            : undefined,

                        pauseStartedAt: tracking.pauseStartedAt
                            ? new Date(tracking.pauseStartedAt)
                            : undefined,

                        restStartedAt: tracking.restStartedAt
                            ? new Date(tracking.restStartedAt)
                            : undefined,

                        activeIntervals: tracking.activeIntervals.map((interval) => ({
                            startedAt: new Date(interval.startedAt),
                            endedAt: interval.endedAt
                                ? new Date(interval.endedAt)
                                : undefined
                        })),

                        pauseIntervals: tracking.pauseIntervals.map((interval) => ({
                            startedAt: new Date(interval.startedAt),
                            endedAt: interval.endedAt
                                ? new Date(interval.endedAt)
                                : undefined
                        })),

                        restIntervals: tracking.restIntervals.map((interval) => ({
                            startedAt: new Date(interval.startedAt),
                            endedAt: interval.endedAt
                                ? new Date(interval.endedAt)
                                : undefined
                        }))
                    }
                }
            })
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


    async update(updatedSession: Session): Promise<Session> {
        const sessions = await this.readSessions()

        const index = sessions.findIndex(
            (session) => session.id === updatedSession.id
        )

        if (index === -1) {
            throw new Error('Sessão não encontrada.')
        }

        sessions[index] = updatedSession

        await this.writeSessions(sessions)

        return updatedSession
    }

}