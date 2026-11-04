import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { test } from 'node:test'

import {
  getSessionResultController,
  recordActivityObservationController
} from '../dist/modules/sessions/sessions.controller.js'
import { SessionsService } from '../dist/modules/sessions/sessions.service.js'

const professionalId = '00000000-0000-4000-8000-000000000001'
const studentId = '00000000-0000-4000-8000-000000000002'
const sessionId = '00000000-0000-4000-8000-000000000003'
const activityId = '00000000-0000-4000-8000-000000000004'

function createFixture() {
  const session = {
    id: sessionId,
    programId: '00000000-0000-4000-8000-000000000005',
    studentId,
    professionalId,
    startedAt: new Date('2026-11-03T10:00:00.000Z'),
    finishedAt: new Date('2026-11-03T10:30:00.000Z'),
    status: 'COMPLETED',
    activities: [{
      activityId,
      order: 1,
      status: 'COMPLETED',
      prescribed: {
        series: 3,
        repeticoes: 12,
        cargaKg: 20,
        prescribedOnly: 99
      },
      execution: {
        values: {
          series: 3,
          repeticoes: 10,
          cargaKg: 15,
          executedOnly: 7
        },
        executedAt: new Date('2026-11-03T10:20:00.000Z')
      },
      observations: ['Desconforto informado pelo aluno.'],
      timeTracking: {
        activeIntervals: [{
          startedAt: new Date('2026-11-03T10:00:00.000Z'),
          endedAt: new Date('2026-11-03T10:20:00.000Z')
        }],
        pauseIntervals: [{
          startedAt: new Date('2026-11-03T10:20:00.000Z'),
          endedAt: new Date('2026-11-03T10:25:00.000Z')
        }],
        restIntervals: [{
          startedAt: new Date('2026-11-03T10:25:00.000Z'),
          endedAt: new Date('2026-11-03T10:26:00.000Z')
        }],
        activeTimeMs: 1_200_000,
        pauseTimeMs: 300_000,
        restTimeMs: 60_000
      }
    }]
  }

  const sessionRepository = {
    async findById(id) {
      return id === sessionId ? session : null
    },
    async update(updated) {
      Object.assign(session, updated)
      return session
    }
  }
  const service = new SessionsService(
    { async findById() { return null } },
    sessionRepository,
    { async listar() { return [] } }
  )

  const app = Fastify()
  const authenticateAsHeaderUser = async (request) => {
    request.user = {
      userId: request.headers['x-user-id'],
      jti: 'test-jti',
      exp: 1
    }
  }
  app.get('/sessions/:sessionId/result', {
    preHandler: authenticateAsHeaderUser
  }, getSessionResultController(service))
  app.post('/sessions/:sessionId/activities/:activityId/observations', {
    preHandler: authenticateAsHeaderUser
  }, recordActivityObservationController(service))

  return { app, session }
}

test('session result returns recorded values and duration without fabricating data', async (t) => {
  const { app, session } = createFixture()
  t.after(() => app.close())

  const response = await app.inject({
    method: 'GET',
    url: `/sessions/${sessionId}/result`,
    headers: { 'x-user-id': professionalId }
  })

  assert.equal(response.statusCode, 200)
  const result = response.json()
  assert.equal(result.durationMs, 1_800_000)
  assert.equal(result.activities[0].status, 'COMPLETED')
  assert.deepEqual(result.activities[0].prescribed, {
    series: 3,
    repeticoes: 12,
    cargaKg: 20,
    prescribedOnly: 99
  })
  assert.deepEqual(result.activities[0].execution.values, {
    series: 3,
    repeticoes: 10,
    cargaKg: 15,
    executedOnly: 7
  })
  assert.deepEqual(result.activities[0].comparison, {
    series: {
      prescribed: 3,
      executed: 3,
      difference: 0,
      different: false
    },
    repeticoes: {
      prescribed: 12,
      executed: 10,
      difference: -2,
      different: true
    },
    cargaKg: {
      prescribed: 20,
      executed: 15,
      difference: -5,
      different: true
    }
  })
  assert.equal(result.activities[0].execution.executedAt, '2026-11-03T10:20:00.000Z')
  assert.deepEqual(session.activities[0].prescribed, {
    series: 3,
    repeticoes: 12,
    cargaKg: 20,
    prescribedOnly: 99
  })
  assert.deepEqual(session.activities[0].execution.values, {
    series: 3,
    repeticoes: 10,
    cargaKg: 15,
    executedOnly: 7
  })
  assert.equal(Object.hasOwn(session.activities[0], 'comparison'), false)
  assert.deepEqual(result.activities[0].observations, [
    'Desconforto informado pelo aluno.'
  ])
  assert.equal(result.activities[0].timeTracking.activeTimeMs, 1_200_000)
  assert.equal(result.activities[0].timeTracking.pauseTimeMs, 300_000)
  assert.equal(result.activities[0].timeTracking.restTimeMs, 60_000)
})

test('unfinished sessions omit duration and observations append without overwriting existing ones', async (t) => {
  const { app, session } = createFixture()
  t.after(() => app.close())
  session.finishedAt = undefined
  session.status = 'IN_PROGRESS'

  const observationResponse = await app.inject({
    method: 'POST',
    url: `/sessions/${sessionId}/activities/${activityId}/observations`,
    headers: { 'x-user-id': studentId },
    payload: { observation: 'Atividade concluída sem dor.' }
  })

  assert.equal(observationResponse.statusCode, 200)
  assert.deepEqual(session.activities[0].observations, [
    'Desconforto informado pelo aluno.',
    'Atividade concluída sem dor.'
  ])

  const resultResponse = await app.inject({
    method: 'GET',
    url: `/sessions/${sessionId}/result`,
    headers: { 'x-user-id': professionalId }
  })
  assert.equal(resultResponse.statusCode, 200)
  assert.equal(Object.hasOwn(resultResponse.json(), 'durationMs'), false)

  const invalidObservation = await app.inject({
    method: 'POST',
    url: `/sessions/${sessionId}/activities/${activityId}/observations`,
    headers: { 'x-user-id': studentId },
    payload: { observation: '   ' }
  })
  assert.equal(invalidObservation.statusCode, 400)
  assert.equal(session.activities[0].observations.length, 2)

  session.status = 'COMPLETED'
  const finalizedObservation = await app.inject({
    method: 'POST',
    url: `/sessions/${sessionId}/activities/${activityId}/observations`,
    headers: { 'x-user-id': studentId },
    payload: { observation: 'Observação depois do encerramento.' }
  })
  assert.equal(finalizedObservation.statusCode, 409)
  assert.equal(session.activities[0].observations.length, 2)
})

test('session results and observations enforce session ownership', async (t) => {
  const { app, session } = createFixture()
  t.after(() => app.close())
  const originalObservations = [...session.activities[0].observations]

  const resultResponse = await app.inject({
    method: 'GET',
    url: `/sessions/${sessionId}/result`,
    headers: { 'x-user-id': '00000000-0000-4000-8000-000000000099' }
  })
  assert.equal(resultResponse.statusCode, 403)

  const observationResponse = await app.inject({
    method: 'POST',
    url: `/sessions/${sessionId}/activities/${activityId}/observations`,
    headers: { 'x-user-id': '00000000-0000-4000-8000-000000000099' },
    payload: { observation: 'Não autorizado.' }
  })
  assert.equal(observationResponse.statusCode, 403)
  assert.deepEqual(session.activities[0].observations, originalObservations)
})

test('result omits unrecorded optional values and zero-initialized time tracking', async (t) => {
  const { app, session } = createFixture()
  t.after(() => app.close())
  session.finishedAt = undefined
  session.status = 'IN_PROGRESS'
  session.activities[0].execution = undefined
  session.activities[0].observations = undefined
  session.activities[0].prescribed = undefined
  session.activities[0].timeTracking = {
    activeIntervals: [],
    pauseIntervals: [],
    restIntervals: [],
    activeTimeMs: 0,
    pauseTimeMs: 0,
    restTimeMs: 0
  }

  const response = await app.inject({
    method: 'GET',
    url: `/sessions/${sessionId}/result`,
    headers: { 'x-user-id': professionalId }
  })

  assert.equal(response.statusCode, 200)
  const result = response.json()
  assert.equal(Object.hasOwn(result, 'durationMs'), false)
  assert.equal(Object.hasOwn(result.activities[0], 'execution'), false)
  assert.equal(Object.hasOwn(result.activities[0], 'observations'), false)
  assert.equal(Object.hasOwn(result.activities[0], 'prescribed'), false)
  assert.equal(Object.hasOwn(result.activities[0], 'comparison'), false)
  assert.equal(Object.hasOwn(result.activities[0], 'timeTracking'), false)
})

test('result omits comparison when either prescribed or executed values are missing', async (t) => {
  const { app, session } = createFixture()
  t.after(() => app.close())

  session.activities[0].execution = undefined
  let response = await app.inject({
    method: 'GET',
    url: `/sessions/${sessionId}/result`,
    headers: { 'x-user-id': professionalId }
  })

  assert.equal(response.statusCode, 200)
  assert.equal(Object.hasOwn(response.json().activities[0], 'comparison'), false)

  session.activities[0].execution = {
    values: { series: 3 },
    executedAt: new Date('2026-11-03T10:20:00.000Z')
  }
  session.activities[0].prescribed = undefined
  response = await app.inject({
    method: 'GET',
    url: `/sessions/${sessionId}/result`,
    headers: { 'x-user-id': professionalId }
  })

  assert.equal(response.statusCode, 200)
  assert.equal(Object.hasOwn(response.json().activities[0], 'comparison'), false)
})

test('result omits comparison when prescribed and executed values have no metrics in common', async (t) => {
  const { app, session } = createFixture()
  t.after(() => app.close())
  session.activities[0].prescribed = { prescribedOnly: 99 }
  session.activities[0].execution.values = { executedOnly: 7 }

  const response = await app.inject({
    method: 'GET',
    url: `/sessions/${sessionId}/result`,
    headers: { 'x-user-id': professionalId }
  })

  assert.equal(response.statusCode, 200)
  const activity = response.json().activities[0]
  assert.equal(Object.hasOwn(activity, 'comparison'), false)
  assert.deepEqual(activity.prescribed, { prescribedOnly: 99 })
  assert.deepEqual(activity.execution.values, { executedOnly: 7 })
  assert.deepEqual(session.activities[0].prescribed, { prescribedOnly: 99 })
  assert.deepEqual(session.activities[0].execution.values, { executedOnly: 7 })
})
