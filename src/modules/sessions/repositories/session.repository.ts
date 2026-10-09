import type { Session } from '../sessions.types.js'

export interface SessionRepository {
    create(session: Session): Promise<Session>
    findById(id: string): Promise<Session | null>
    findByStudentId(studentId: string): Promise<Session[]>
}