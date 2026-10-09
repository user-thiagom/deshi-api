export type SessionStatus = 'IN_PROGRESS'

export type SessionActivityStatus = 'PENDING' | 'COMPLETED'

export interface SessionActivity {
    activityId: string
    order: number
    status: SessionActivityStatus
}

export interface Session {
    id: string
    programId: string
    studentId: string
    professionalId: string
    startedAt: Date
    status: SessionStatus
    activities: SessionActivity[]
}