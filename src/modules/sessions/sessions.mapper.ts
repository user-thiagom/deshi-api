import type { Session, SessionActivity } from './sessions.types.js'

type MetricComparison = {
    prescribed: number
    executed: number
    difference: number
    different: boolean
}

type SessionActivityResult = SessionActivity & {
    comparison?: Record<string, MetricComparison>
}

export type SessionResult = Omit<Session, 'activities'> & {
    activities: SessionActivityResult[]
    durationMs?: number
}

function compareActivityValues(
    activity: SessionActivity
): Record<string, MetricComparison> | undefined {
    const prescribedValues = activity.prescribed
    const executedValues = activity.execution?.values

    if (!prescribedValues || !executedValues) {
        return undefined
    }

    const comparison = Object.fromEntries(
        Object.entries(prescribedValues)
            .filter(([metric]) =>
                Object.hasOwn(executedValues, metric)
            )
            .map(([metric, prescribed]) => {
                const executed = executedValues[metric]

                return [
                    metric,
                    {
                        prescribed,
                        executed,
                        difference: executed - prescribed,
                        different: executed !== prescribed
                    }
                ]
            })
    )

    return Object.keys(comparison).length > 0
        ? comparison
        : undefined
}

function includeRecordedTimeTracking(
    activity: SessionActivityResult
): SessionActivityResult {
    const tracking = activity.timeTracking

    if (
        !tracking ||
        tracking.activeStartedAt ||
        tracking.pauseStartedAt ||
        tracking.restStartedAt ||
        tracking.activeIntervals.length > 0 ||
        tracking.pauseIntervals.length > 0 ||
        tracking.restIntervals.length > 0 ||
        tracking.activeTimeMs > 0 ||
        tracking.pauseTimeMs > 0 ||
        tracking.restTimeMs > 0
    ) {
        return activity
    }

    const { timeTracking: _timeTracking, ...activityWithoutTracking } = activity
    return activityWithoutTracking
}

export function toSessionResult(session: Session): SessionResult {
    const activities = session.activities.map((activity) => {
        const comparison = compareActivityValues(activity)
        const activityResult = comparison === undefined
            ? activity
            : { ...activity, comparison }

        return includeRecordedTimeTracking(activityResult)
    })

    if (!session.finishedAt) {
        return { ...session, activities }
    }

    const durationMs = session.finishedAt.getTime() - session.startedAt.getTime()

    if (!Number.isFinite(durationMs) || durationMs < 0) {
        return { ...session, activities }
    }

    return {
        ...session,
        activities,
        durationMs
    }
}