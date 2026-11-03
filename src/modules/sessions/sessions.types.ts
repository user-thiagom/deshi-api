
export type SessionStatus = 'IN_PROGRESS'

export type SessionActivityStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'PAUSED'
  | 'RESTING'
  | 'COMPLETED'
  | 'INCOMPLETE'

export interface ActivityTimeInterval {
  startedAt: Date
  endedAt?: Date
}

export interface ActivityTimeTracking {
  activeStartedAt?: Date
  activeIntervals: ActivityTimeInterval[]
  pauseStartedAt?: Date
  pauseIntervals: ActivityTimeInterval[]
  restStartedAt?: Date
  restIntervals: ActivityTimeInterval[]
  activeTimeMs: number
  pauseTimeMs: number
  restTimeMs: number
}

export interface SessionActivity {
  activityId: string
  order: number
  status: SessionActivityStatus
  timeTracking?: ActivityTimeTracking

  execution?: {
    values: Record<string, number>
    executedAt: Date
  }
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
