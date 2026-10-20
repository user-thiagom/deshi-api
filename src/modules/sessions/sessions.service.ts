import { randomUUID } from 'node:crypto'
import { ProgramNotFoundError,ProgramNotOwnedByStudentError } from './sessions.errors.js'

import type { ProgramRepository } from '../programs/repositories/program.repository.js'
import type { SessionRepository } from './repositories/session.repository.js'
import type { Session } from './sessions.types.js'

export class SessionsService {
    constructor(
        private readonly programRepository: ProgramRepository,
        private readonly sessionRepository: SessionRepository
    ) {}

    async startSession(
        programId: string,
        studentId: string
    ): Promise<Session> {
        const program = await this.programRepository.findById(programId)

        if (!program) {
            throw new ProgramNotFoundError()
        }

        if (program.studentId !== studentId) {
            throw new ProgramNotOwnedByStudentError()
        }

        const session: Session = {
            id: randomUUID(),
            programId: program.id,
            studentId,
            professionalId: program.professionalId,
            startedAt: new Date(),
            status: 'IN_PROGRESS',
            activities: [...program.activities]
                .sort((a, b) => a.order - b.order)
                .map((activity) => ({
                    activityId: activity.activityId,
                    order: activity.order,
                    status: 'PENDING'
                }))
        }

        return this.sessionRepository.create(session)
    }
}