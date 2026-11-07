export type SessionStatus =
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'INTERRUPTED'

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
  observations?: string[]
  prescribed?: Record<string, number>

  execution?: {
    values: Record<string, number>
    executedAt: Date
  }
}

export interface Session {
  id: string
  programId: string
  programVersion?: number
  studentId: string
  professionalId: string
  startedAt: Date
  finishedAt?: Date
  status: SessionStatus
  activities: SessionActivity[]
}

export interface EvolutionPoint {
  sessionId: string
  value: number
  executedAt: string
}

export interface ActivityMetricEvolution {
  activityId: string
  activityName?: string
  modalityId?: string
  modalityName?: string
  metric: string
  points: EvolutionPoint[]
}

export interface StudentEvolution {
  studentId: string
  evolution: ActivityMetricEvolution[]
}
