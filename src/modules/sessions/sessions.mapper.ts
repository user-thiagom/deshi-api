import type { Session, SessionActivity } from './sessions.types.js'

export type SessionResult = Session & {
    durationMs?: number
}

function includeRecordedTimeTracking(
    activity: SessionActivity
): SessionActivity {
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
    const activities = session.activities.map(includeRecordedTimeTracking)

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