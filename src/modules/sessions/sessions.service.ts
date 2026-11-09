import { randomUUID } from 'node:crypto'

import {
    ProgramNotFoundError,
    ProgramNotOwnedByStudentError,
    SessionNotFoundError,
    SessionNotOwnedByStudentError,
    SessionActivityNotFoundError,
    InvalidActivityStateError
} from './sessions.errors.js'

import type { ProgramRepository } from '../programs/repositories/program.repository.js'
import type { SessionRepository } from './repositories/session.repository.js'
import type { Session, SessionActivity } from './sessions.types.js'

export class SessionsService {
    constructor(
        private readonly programRepository: ProgramRepository,
        private readonly sessionRepository: SessionRepository
    ) { }

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
                    status: 'PENDING' as const,
                    timeTracking: {
                        activeIntervals: [],
                        pauseIntervals: [],
                        restIntervals: [],
                        activeTimeMs: 0,
                        pauseTimeMs: 0,
                        restTimeMs: 0
                    }
                }))
        }

        return this.sessionRepository.create(session)
    }

    async registerExecution(
        sessionId: string,
        studentId: string,
        activityId: string,
        values: Record<string, number>,
        status: 'COMPLETED' | 'INCOMPLETE'
    ): Promise<Session> {
        const session = await this.sessionRepository.findById(sessionId)

        if (!session) {
            throw new SessionNotFoundError()
        }

        if (session.studentId !== studentId) {
            throw new SessionNotOwnedByStudentError()
        }

        const activity = session.activities.find(
            (item) => item.activityId === activityId
        )

        if (!activity) {
            throw new SessionActivityNotFoundError()
        }

        activity.status = status
        activity.execution = {
            values,
            executedAt: new Date()
        }

        return this.sessionRepository.update(session)
    }

    async startActivity(
        sessionId: string,
        studentId: string,
        activityId: string
    ): Promise<Session> {
        const session = await this.sessionRepository.findById(sessionId)

        if (!session) {
            throw new SessionNotFoundError()
        }

        if (session.studentId !== studentId) {
            throw new SessionNotOwnedByStudentError()
        }

        const activity = session.activities.find(
            (item) => item.activityId === activityId
        )

        if (!activity) {
            throw new SessionActivityNotFoundError()
        }

        if (activity.status !== 'PENDING') {
            throw new InvalidActivityStateError(
                'A atividade só pode ser iniciada quando estiver pendente.'
            )
        }

        const now = new Date()

        activity.status = 'IN_PROGRESS'
        activity.timeTracking ??= {
            activeIntervals: [],
            pauseIntervals: [],
            restIntervals: [],
            activeTimeMs: 0,
            pauseTimeMs: 0,
            restTimeMs: 0
        }

        activity.timeTracking.activeStartedAt = now
        activity.timeTracking.activeIntervals.push({
            startedAt: now
        })

        return this.sessionRepository.update(session)
    }

    async pauseActivity(
        sessionId: string,
        studentId: string,
        activityId: string
    ): Promise<Session> {
        const session = await this.sessionRepository.findById(sessionId)

        if (!session) {
            throw new SessionNotFoundError()
        }

        if (session.studentId !== studentId) {
            throw new SessionNotOwnedByStudentError()
        }

        const activity = session.activities.find(
            (item) => item.activityId === activityId
        )

        if (!activity) {
            throw new SessionActivityNotFoundError()
        }

        if (activity.status !== 'IN_PROGRESS') {
            throw new InvalidActivityStateError(
                'Somente uma atividade em execução pode ser pausada.'
            )
        }

        const tracking = activity.timeTracking

        if (!tracking?.activeStartedAt) {
            throw new InvalidActivityStateError(
                'Não existe um intervalo ativo para pausar.'
            )
        }

        const now = new Date()

        const activeInterval = tracking.activeIntervals[
            tracking.activeIntervals.length - 1
        ]

        if (!activeInterval || activeInterval.endedAt) {
            throw new InvalidActivityStateError(
                'Não existe um intervalo ativo aberto.'
            )
        }

        activeInterval.endedAt = now

        tracking.activeTimeMs +=
            now.getTime() - tracking.activeStartedAt.getTime()

        tracking.activeStartedAt = undefined
        tracking.pauseStartedAt = now

        tracking.pauseIntervals.push({
            startedAt: now
        })

        activity.status = 'PAUSED'

        return this.sessionRepository.update(session)
    }

    async resumeActivity(
        sessionId: string,
        studentId: string,
        activityId: string
    ): Promise<Session> {
        const session = await this.sessionRepository.findById(sessionId)

        if (!session) {
            throw new SessionNotFoundError()
        }

        if (session.studentId !== studentId) {
            throw new SessionNotOwnedByStudentError()
        }

        const activity = session.activities.find(
            (item) => item.activityId === activityId
        )

        if (!activity) {
            throw new SessionActivityNotFoundError()
        }

        if (activity.status !== 'PAUSED') {
            throw new InvalidActivityStateError(
                'Somente uma atividade pausada pode ser retomada.'
            )
        }

        const tracking = activity.timeTracking

        if (!tracking?.pauseStartedAt) {
            throw new InvalidActivityStateError(
                'Não existe uma pausa em andamento.'
            )
        }

        const now = new Date()

        const pauseInterval = tracking.pauseIntervals[
            tracking.pauseIntervals.length - 1
        ]

        if (!pauseInterval || pauseInterval.endedAt) {
            throw new InvalidActivityStateError(
                'Não existe um intervalo de pausa aberto.'
            )
        }

        pauseInterval.endedAt = now

        tracking.pauseTimeMs +=
            now.getTime() - tracking.pauseStartedAt.getTime()

        tracking.pauseStartedAt = undefined
        tracking.activeStartedAt = now

        tracking.activeIntervals.push({
            startedAt: now
        })

        activity.status = 'IN_PROGRESS'

        return this.sessionRepository.update(session)
    }

    async startRest(
        sessionId: string,
        studentId: string,
        activityId: string
    ): Promise<Session> {
        const session = await this.sessionRepository.findById(sessionId)

        if (!session) {
            throw new SessionNotFoundError()
        }

        if (session.studentId !== studentId) {
            throw new SessionNotOwnedByStudentError()
        }

        const activity = session.activities.find(
            (item) => item.activityId === activityId
        )

        if (!activity) {
            throw new SessionActivityNotFoundError()
        }

        if (activity.status !== 'IN_PROGRESS') {
            throw new InvalidActivityStateError(
                'Somente uma atividade em execução pode iniciar um descanso.'
            )
        }

        const tracking = activity.timeTracking

        if (!tracking?.activeStartedAt) {
            throw new InvalidActivityStateError(
                'Não existe um intervalo ativo para iniciar o descanso.'
            )
        }

        const now = new Date()

        const activeInterval = tracking.activeIntervals[
            tracking.activeIntervals.length - 1
        ]

        if (!activeInterval || activeInterval.endedAt) {
            throw new InvalidActivityStateError(
                'Não existe um intervalo ativo aberto.'
            )
        }

        activeInterval.endedAt = now
        tracking.activeTimeMs +=
            now.getTime() - tracking.activeStartedAt.getTime()

        tracking.activeStartedAt = undefined
        tracking.restStartedAt = now
        tracking.restIntervals.push({ startedAt: now })

        activity.status = 'RESTING'

        return this.sessionRepository.update(session)
    }

    async endRest(
        sessionId: string,
        studentId: string,
        activityId: string
    ): Promise<Session> {
        const session = await this.sessionRepository.findById(sessionId)

        if (!session) {
            throw new SessionNotFoundError()
        }

        if (session.studentId !== studentId) {
            throw new SessionNotOwnedByStudentError()
        }

        const activity = session.activities.find(
            (item) => item.activityId === activityId
        )

        if (!activity) {
            throw new SessionActivityNotFoundError()
        }

        if (activity.status !== 'RESTING') {
            throw new InvalidActivityStateError(
                'Somente uma atividade em descanso pode encerrar o descanso.'
            )
        }

        const tracking = activity.timeTracking

        if (!tracking?.restStartedAt) {
            throw new InvalidActivityStateError(
                'Não existe um intervalo de descanso em andamento.'
            )
        }

        const now = new Date()

        const restInterval = tracking.restIntervals[
            tracking.restIntervals.length - 1
        ]

        if (!restInterval || restInterval.endedAt) {
            throw new InvalidActivityStateError(
                'Não existe um intervalo de descanso aberto.'
            )
        }

        // Encerra o intervalo de descanso
        restInterval.endedAt = now

        tracking.restTimeMs +=
            now.getTime() - tracking.restStartedAt.getTime()

        tracking.restStartedAt = undefined

        // Inicia um novo intervalo ativo
        tracking.activeStartedAt = now

        tracking.activeIntervals.push({
            startedAt: now
        })

        activity.status = 'IN_PROGRESS'

        return this.sessionRepository.update(session)
    }

    private closeOpenActivityInterval(
        activity: SessionActivity,
        now: Date
    ): void {
        const tracking = activity.timeTracking

        if (!tracking) {
            return
        }

        if (activity.status === 'IN_PROGRESS') {
            const interval = tracking.activeIntervals[
                tracking.activeIntervals.length - 1
            ]

            if (tracking.activeStartedAt && interval && !interval.endedAt) {
                interval.endedAt = now

                tracking.activeTimeMs +=
                    now.getTime() - tracking.activeStartedAt.getTime()

                tracking.activeStartedAt = undefined
            }
        }

        if (activity.status === 'PAUSED') {
            const interval = tracking.pauseIntervals[
                tracking.pauseIntervals.length - 1
            ]

            if (tracking.pauseStartedAt && interval && !interval.endedAt) {
                interval.endedAt = now

                tracking.pauseTimeMs +=
                    now.getTime() - tracking.pauseStartedAt.getTime()

                tracking.pauseStartedAt = undefined
            }
        }

        if (activity.status === 'RESTING') {
            const interval = tracking.restIntervals[
                tracking.restIntervals.length - 1
            ]

            if (tracking.restStartedAt && interval && !interval.endedAt) {
                interval.endedAt = now

                tracking.restTimeMs +=
                    now.getTime() - tracking.restStartedAt.getTime()

                tracking.restStartedAt = undefined
            }
        }
    }

    async completeActivity(
        sessionId: string,
        studentId: string,
        activityId: string
    ): Promise<Session> {
        const session = await this.sessionRepository.findById(sessionId)

        if (!session) {
            throw new SessionNotFoundError()
        }

        if (session.studentId !== studentId) {
            throw new SessionNotOwnedByStudentError()
        }

        const activity = session.activities.find(
            (item) => item.activityId === activityId
        )

        if (!activity) {
            throw new SessionActivityNotFoundError()
        }

        if (
            activity.status !== 'IN_PROGRESS' &&
            activity.status !== 'PAUSED' &&
            activity.status !== 'RESTING'
        ) {
            throw new InvalidActivityStateError(
                'A atividade não pode ser concluída no estado atual.'
            )
        }

        const tracking = activity.timeTracking

        if (!tracking) {
            throw new InvalidActivityStateError(
                'Não existe controle de tempo para esta atividade.'
            )
        }

        const now = new Date()

        // Encerra o intervalo ativo, se estiver em execução
        if (activity.status === 'IN_PROGRESS') {
            const activeInterval = tracking.activeIntervals[
                tracking.activeIntervals.length - 1
            ]

            if (!tracking.activeStartedAt || !activeInterval || activeInterval.endedAt) {
                throw new InvalidActivityStateError(
                    'Não existe um intervalo ativo aberto.'
                )
            }

            activeInterval.endedAt = now

            tracking.activeTimeMs +=
                now.getTime() - tracking.activeStartedAt.getTime()

            tracking.activeStartedAt = undefined
        }

        // Encerra o intervalo de pausa, se estiver pausada
        if (activity.status === 'PAUSED') {
            const pauseInterval = tracking.pauseIntervals[
                tracking.pauseIntervals.length - 1
            ]

            if (!tracking.pauseStartedAt || !pauseInterval || pauseInterval.endedAt) {
                throw new InvalidActivityStateError(
                    'Não existe um intervalo de pausa aberto.'
                )
            }

            pauseInterval.endedAt = now

            tracking.pauseTimeMs +=
                now.getTime() - tracking.pauseStartedAt.getTime()

            tracking.pauseStartedAt = undefined
        }

        // Encerra o intervalo de descanso, se estiver descansando
        if (activity.status === 'RESTING') {
            const restInterval = tracking.restIntervals[
                tracking.restIntervals.length - 1
            ]

            if (!tracking.restStartedAt || !restInterval || restInterval.endedAt) {
                throw new InvalidActivityStateError(
                    'Não existe um intervalo de descanso aberto.'
                )
            }

            restInterval.endedAt = now

            tracking.restTimeMs +=
                now.getTime() - tracking.restStartedAt.getTime()

            tracking.restStartedAt = undefined
        }

        activity.status = 'COMPLETED'

        return this.sessionRepository.update(session)
    }

    async finishSession(
        sessionId: string,
        studentId: string
    ): Promise<Session> {
        const session = await this.sessionRepository.findById(sessionId)

        if (!session) {
            throw new SessionNotFoundError()
        }

        if (session.studentId !== studentId) {
            throw new SessionNotOwnedByStudentError()
        }

        if (session.status !== 'IN_PROGRESS') {
            throw new InvalidActivityStateError(
                'Somente uma sessão em andamento pode ser finalizada.'
            )
        }

        const now = new Date()

        for (const activity of session.activities) {
            if (
                activity.status === 'IN_PROGRESS' ||
                activity.status === 'PAUSED' ||
                activity.status === 'RESTING'
            ) {
                this.closeOpenActivityInterval(activity, now)
                activity.status = 'INCOMPLETE'
            }
        }

        session.status = 'COMPLETED'
        session.finishedAt = now

        return this.sessionRepository.update(session)
    }

    async interruptSession(
        sessionId: string,
        studentId: string
    ): Promise<Session> {
        const session = await this.sessionRepository.findById(sessionId)

        if (!session) {
            throw new SessionNotFoundError()
        }

        if (session.studentId !== studentId) {
            throw new SessionNotOwnedByStudentError()
        }

        if (session.status !== 'IN_PROGRESS') {
            throw new InvalidActivityStateError(
                'Somente uma sessão em andamento pode ser interrompida.'
            )
        }

        const now = new Date()

        for (const activity of session.activities) {
            if (
                activity.status === 'IN_PROGRESS' ||
                activity.status === 'PAUSED' ||
                activity.status === 'RESTING'
            ) {
                this.closeOpenActivityInterval(activity, now)
                activity.status = 'INCOMPLETE'
            }
        }

        session.status = 'INTERRUPTED'
        session.finishedAt = now

        return this.sessionRepository.update(session)
    }

    async getStudentSessions(
        studentId: string
    ): Promise<Session[]> {
        return this.sessionRepository.findByStudentId(studentId)
    }
}