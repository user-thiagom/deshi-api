import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import Fastify from 'fastify'
import jwt from 'jsonwebtoken'

const root = fileURLToPath(new URL('../', import.meta.url))
const secret = 'sessions-test-secret'

function token(userId) {
    return jwt.sign({ userId }, secret, { jwtid: randomUUID(), expiresIn: '1h' })
}

test('US13–US16 — session lifecycle over HTTP with isolated JSON persistence', { timeout: 90_000 }, async (t) => {
    const temporary = await fs.mkdtemp(path.join(root, 'tests', '.tmp-sessions-'))
    const data = path.join(temporary, 'data')
    const studentId = randomUUID()
    const otherStudentId = randomUUID()
    const professionalId = randomUUID()
    const programId = randomUUID()
    const otherProgramId = randomUUID()
    const activityIds = [randomUUID(), randomUUID()]
    const iso = (date) => new Date(date).toISOString()
    const originalCwd = process.cwd()
    const previousSecret = process.env.JWT_SECRET
    const app = Fastify()

    try {
        await fs.mkdir(data)
        const writeJson = (name, value) => fs.writeFile(
            path.join(data, name),
            `${JSON.stringify(value, null, 2)}\n`
        )
        await Promise.all([
            writeJson('users.json', [
                { id: studentId, profile: 'STUDENT' },
                { id: otherStudentId, profile: 'STUDENT' },
                { id: professionalId, profile: 'PROFESSIONAL' }
            ]),
            writeJson('revoked-tokens.json', []),
            writeJson('sessions.json', []),
            writeJson('programs.json', [
                {
                    id: programId,
                    professionalId,
                    studentId,
                    name: 'Programa de teste',
                    modalityId: randomUUID(),
                    activities: activityIds.map((activityId, index) => ({ activityId, order: index + 1 })),
                    createdAt: iso('2026-01-01T10:00:00.000Z')
                },
                {
                    id: otherProgramId,
                    professionalId,
                    studentId: otherStudentId,
                    name: 'Programa de outro aluno',
                    modalityId: randomUUID(),
                    activities: [{ activityId: randomUUID(), order: 1 }],
                    createdAt: iso('2026-01-01T10:00:00.000Z')
                }
            ])
        ])

        process.env.JWT_SECRET = secret
        process.chdir(temporary)
        const { sessionRoutes } = await import('../dist/modules/sessions/sessions.routes.js')
        app.register(sessionRoutes)
        await app.ready()
        const request = async (method, url, credential, body) => {
            const response = await app.inject({
                method,
                url,
                ...(credential ? { headers: { authorization: `Bearer ${credential}` } } : {}),
                ...(body === undefined ? {} : { payload: body })
            })
            return { status: response.statusCode, body: response.json() }
        }
        const studentToken = token(studentId)
        let firstSessionId
        let finishedSessionId
        let interruptedSessionId

        await t.test('US13 starts a session for an owned program with activities in prescribed order', async () => {
            assert.equal((await request('POST', '/sessions', undefined, { programId })).status, 401)
            assert.equal((await request('POST', '/sessions', token(professionalId), { programId })).status, 403)
            assert.equal((await request('POST', '/sessions', studentToken, {})).status, 400)
            assert.equal((await request('POST', '/sessions', studentToken, { programId: randomUUID() })).status, 404)
            assert.equal((await request('POST', '/sessions', token(otherStudentId), { programId })).status, 403)

            const response = await request('POST', '/sessions', studentToken, { programId })
            assert.equal(response.status, 201)
            firstSessionId = response.body.id
            assert.equal(response.body.programId, programId)
            assert.equal(response.body.studentId, studentId)
            assert.equal(response.body.professionalId, professionalId)
            assert.equal(response.body.status, 'IN_PROGRESS')
            assert.ok(response.body.startedAt)
            assert.deepEqual(response.body.activities.map(({ activityId, order, status }) => ({ activityId, order, status })), [
                { activityId: activityIds[0], order: 1, status: 'PENDING' },
                { activityId: activityIds[1], order: 2, status: 'PENDING' }
            ])
        })

        await t.test('US14 records completion values without changing the prescribed program', async () => {
            const programBefore = await fs.readFile(path.join(data, 'programs.json'), 'utf8')
            assert.equal((await request('POST', `/sessions/${firstSessionId}/executions`, studentToken, {
                activityId: activityIds[0], values: { repetitions: '12' }, status: 'COMPLETED'
            })).status, 400)

            const response = await request('POST', `/sessions/${firstSessionId}/executions`, studentToken, {
                activityId: activityIds[0],
                values: { repetitions: 12, weightKg: 20 },
                status: 'COMPLETED'
            })
            assert.equal(response.status, 200)
            const activity = response.body.activities.find(({ activityId }) => activityId === activityIds[0])
            assert.equal(activity.status, 'COMPLETED')
            assert.deepEqual(activity.execution.values, { repetitions: 12, weightKg: 20 })
            assert.ok(activity.execution.executedAt)
            assert.equal(await fs.readFile(path.join(data, 'programs.json'), 'utf8'), programBefore)

            assert.equal((await request('POST', `/sessions/${firstSessionId}/executions`, token(otherStudentId), {
                activityId: activityIds[0], values: {}, status: 'COMPLETED'
            })).status, 403)
            assert.equal((await request('POST', `/sessions/${randomUUID()}/executions`, studentToken, {
                activityId: activityIds[0], values: {}, status: 'COMPLETED'
            })).status, 404)
        })

        await t.test('US15 tracks active, paused, and rest intervals through completion', async () => {
            let response = await request('POST', `/sessions/${firstSessionId}/activities/${activityIds[1]}/start`, studentToken)
            assert.equal(response.status, 200)
            assert.equal(response.body.activities[1].status, 'IN_PROGRESS')
            assert.equal(response.body.activities[1].timeTracking.activeIntervals.length, 1)

            response = await request('POST', `/sessions/${firstSessionId}/activities/${activityIds[1]}/pause`, studentToken)
            assert.equal(response.body.activities[1].status, 'PAUSED')
            assert.ok(response.body.activities[1].timeTracking.activeIntervals[0].endedAt)
            assert.equal(response.body.activities[1].timeTracking.pauseIntervals.length, 1)

            response = await request('POST', `/sessions/${firstSessionId}/activities/${activityIds[1]}/resume`, studentToken)
            assert.equal(response.body.activities[1].status, 'IN_PROGRESS')
            assert.ok(response.body.activities[1].timeTracking.pauseIntervals[0].endedAt)

            response = await request('POST', `/sessions/${firstSessionId}/activities/${activityIds[1]}/rest/start`, studentToken)
            assert.equal(response.body.activities[1].status, 'RESTING')
            assert.equal(response.body.activities[1].timeTracking.restIntervals.length, 1)

            response = await request('POST', `/sessions/${firstSessionId}/activities/${activityIds[1]}/rest/end`, studentToken)
            assert.equal(response.body.activities[1].status, 'IN_PROGRESS')
            assert.ok(response.body.activities[1].timeTracking.restIntervals[0].endedAt)

            response = await request('POST', `/sessions/${firstSessionId}/activities/${activityIds[1]}/complete`, studentToken)
            assert.equal(response.status, 200)
            assert.equal(response.body.activities[1].status, 'COMPLETED')
            assert.ok(response.body.activities[1].timeTracking.activeIntervals.at(-1).endedAt)

            const invalidTransition = await request('POST', `/sessions/${firstSessionId}/activities/${activityIds[1]}/pause`, studentToken)
            assert.equal(invalidTransition.status, 409)
        })

        await t.test('US16 finishes a session, closes active work as incomplete, and exposes it in history', async () => {
            const started = await request('POST', '/sessions', studentToken, { programId })
            finishedSessionId = started.body.id
            await request('POST', `/sessions/${finishedSessionId}/activities/${activityIds[0]}/start`, studentToken)

            const response = await request('POST', `/sessions/${finishedSessionId}/finish`, studentToken)
            assert.equal(response.status, 200)
            assert.equal(response.body.status, 'COMPLETED')
            assert.ok(response.body.finishedAt)
            assert.equal(response.body.activities[0].status, 'INCOMPLETE')
            assert.ok(response.body.activities[0].timeTracking.activeIntervals[0].endedAt)
            assert.equal(response.body.activities[1].status, 'PENDING')
            assert.equal((await request('POST', `/sessions/${finishedSessionId}/finish`, studentToken)).status, 409)
        })

        await t.test('interrupts a session and closes an active rest interval', async () => {
            const started = await request('POST', '/sessions', studentToken, { programId })
            interruptedSessionId = started.body.id
            await request('POST', `/sessions/${interruptedSessionId}/activities/${activityIds[0]}/start`, studentToken)
            await request('POST', `/sessions/${interruptedSessionId}/activities/${activityIds[0]}/rest/start`, studentToken)

            const response = await request('POST', `/sessions/${interruptedSessionId}/interrupt`, studentToken)
            assert.equal(response.status, 200)
            assert.equal(response.body.status, 'INTERRUPTED')
            assert.ok(response.body.finishedAt)
            assert.equal(response.body.activities[0].status, 'INCOMPLETE')
            assert.ok(response.body.activities[0].timeTracking.restIntervals[0].endedAt)
            assert.equal((await request('POST', `/sessions/${interruptedSessionId}/interrupt`, studentToken)).status, 409)
        })

        await t.test('history contains only the authenticated student’s sessions', async () => {
            const ownHistory = await request('GET', '/sessions/history', studentToken)
            assert.equal(ownHistory.status, 200)
            assert.deepEqual(ownHistory.body.map(({ id }) => id), [
                firstSessionId,
                finishedSessionId,
                interruptedSessionId
            ])
            assert.ok(ownHistory.body.every(({ studentId: owner }) => owner === studentId))
            assert.deepEqual((await request('GET', '/sessions/history', token(otherStudentId))).body, [])
            assert.equal((await request('GET', '/sessions/history')).status, 401)
        })

        const persisted = JSON.parse(await fs.readFile(path.join(data, 'sessions.json'), 'utf8'))
        assert.equal(persisted.length, 3)
        assert.deepEqual(persisted.map(({ status }) => status), ['IN_PROGRESS', 'COMPLETED', 'INTERRUPTED'])
    } finally {
        await app.close()
        process.chdir(originalCwd)
        if (previousSecret === undefined) delete process.env.JWT_SECRET
        else process.env.JWT_SECRET = previousSecret
        await fs.rm(temporary, { recursive: true, force: true })
    }
})
