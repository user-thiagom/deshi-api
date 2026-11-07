import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Fastify from 'fastify'
import jwt from 'jsonwebtoken'
import { test } from 'node:test'

import { JsonSessionRepository } from '../dist/modules/sessions/repositories/json-session.repository.js'
import { SessionsService } from '../dist/modules/sessions/sessions.service.js'

const professionalId = '00000000-0000-4000-8000-000000000001'
const otherProfessionalId = '00000000-0000-4000-8000-000000000002'
const studentId = '00000000-0000-4000-8000-000000000003'
const squatId = '00000000-0000-4000-8000-000000000004'
const swimId = '00000000-0000-4000-8000-000000000005'
const strengthModalityId = '00000000-0000-4000-8000-000000000006'
const swimModalityId = '00000000-0000-4000-8000-000000000007'

function createSession(id, activities, sessionProfessionalId = professionalId) {
  return {
    id,
    programId: '00000000-0000-4000-8000-000000000008',
    studentId,
    professionalId: sessionProfessionalId,
    startedAt: new Date('2026-10-01T10:00:00.000Z'),
    status: 'COMPLETED',
    activities
  }
}

function createActivity(activityId, executedAt, values, prescribed) {
  return {
    activityId,
    order: 0,
    status: 'COMPLETED',
    prescribed,
    execution: executedAt
      ? { values, executedAt: new Date(executedAt) }
      : undefined
  }
}

function createService(sessions) {
  return new SessionsService(
    {},
    { async findByStudentId(id) { return sessions.filter((session) => session.studentId === id) } },
    {},
    {
      async listar() {
        return [
          { id: squatId, nome: 'Agachamento', modalidadeId: strengthModalityId },
          { id: swimId, nome: 'Nado', modalidadeId: swimModalityId }
        ]
      }
    },
    {
      async listarCatalogo() {
        return [
          { id: strengthModalityId, nome: 'Força' },
          { id: swimModalityId, nome: 'Natação' }
        ]
      }
    }
  )
}

test('session repository restores execution dates as Date values across create, read, and update', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'deshi-session-execution-date-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))

  const filePath = path.join(directory, 'sessions.json')
  const legacySession = createSession('legacy', [
    createActivity(squatId, '2026-10-01T10:00:00.000Z', { repetitions: 5 })
  ])
  await fs.writeFile(filePath, JSON.stringify([legacySession]))

  const repository = new JsonSessionRepository(filePath)
  const restoredSession = await repository.findById('legacy')
  assert.ok(restoredSession.activities[0].execution.executedAt instanceof Date)
  assert.equal(
    restoredSession.activities[0].execution.executedAt.toISOString(),
    '2026-10-01T10:00:00.000Z'
  )

  const createdSession = createSession('created', [
    createActivity(squatId, '2026-10-02T10:00:00.000Z', { repetitions: 6 })
  ])
  await repository.create(createdSession)
  assert.ok((await repository.findById('created')).activities[0].execution.executedAt instanceof Date)

  const updatedSession = await repository.findById('legacy')
  updatedSession.activities[0].execution.values.repetitions = 7
  await repository.update(updatedSession)
  const rereadSession = (await repository.findByStudentId(studentId))
    .find((session) => session.id === 'legacy')
  assert.ok(rereadSession.activities[0].execution.executedAt instanceof Date)
  assert.equal(rereadSession.activities[0].execution.values.repetitions, 7)
})

test('evolution groups executed metrics, enriches catalog data, and sorts points chronologically', async () => {
  const service = createService([
    createSession('later', [
      createActivity(squatId, '2026-10-05T10:00:00.000Z', { repetitions: 8, weight: 40 }, {
        repetitions: 999,
        prescribedOnly: 100
      }),
      createActivity(swimId, '2026-10-05T10:30:00.000Z', { distance: 500 })
    ]),
    createSession('earlier', [
      createActivity(squatId, '2026-10-01T10:00:00.000Z', { repetitions: 5, weight: 30 })
    ]),
    createSession('without-execution', [
      createActivity(squatId, undefined, {}, { repetitions: 1000, prescribedOnly: 50 })
    ]),
    createSession('other-professional', [
      createActivity(squatId, '2026-10-02T10:00:00.000Z', { repetitions: 99 })
    ], otherProfessionalId)
  ])

  const response = await service.getProfessionalStudentEvolution(studentId, professionalId)
  const repetitions = response.evolution.find((entry) => (
    entry.activityId === squatId && entry.metric === 'repetitions'
  ))
  const weight = response.evolution.find((entry) => (
    entry.activityId === squatId && entry.metric === 'weight'
  ))
  const distance = response.evolution.find((entry) => (
    entry.activityId === swimId && entry.metric === 'distance'
  ))

  assert.equal(response.studentId, studentId)
  assert.deepEqual(repetitions.points.map((point) => point.sessionId), ['earlier', 'later'])
  assert.deepEqual(repetitions.points.map((point) => point.value), [5, 8])
  assert.equal(repetitions.activityName, 'Agachamento')
  assert.equal(repetitions.modalityId, strengthModalityId)
  assert.equal(repetitions.modalityName, 'Força')
  assert.deepEqual(weight.points.map((point) => point.value), [30, 40])
  assert.equal(distance.modalityName, 'Natação')
  assert.deepEqual(distance.points.map((point) => point.value), [500])
  assert.equal(response.evolution.some((entry) => entry.metric === 'prescribedOnly'), false)
  assert.equal(response.evolution.flatMap((entry) => entry.points).some((point) => (
    point.sessionId === 'without-execution' || point.sessionId === 'other-professional'
  )), false)
})

test('evolution accepts activity and metric filters and returns no points without execution history', async () => {
  const service = createService([
    createSession('one', [
      createActivity(squatId, '2026-10-01T10:00:00.000Z', { repetitions: 5, weight: 30 })
    ])
  ])

  assert.deepEqual(
    await service.getProfessionalStudentEvolution(studentId, professionalId, {
      activityId: squatId,
      metric: 'weight'
    }).then((response) => response.evolution.map((entry) => entry.metric)),
    ['weight']
  )
  assert.deepEqual(
    await createService([]).getProfessionalStudentEvolution(studentId, professionalId),
    { studentId, evolution: [] }
  )
  assert.deepEqual(
    await createService([
      createSession('prescribed-only', [
        createActivity(squatId, undefined, {}, { repetitions: 20 })
      ])
    ]).getProfessionalStudentEvolution(studentId, professionalId),
    { studentId, evolution: [] }
  )
})

test('professional evolution route enforces role and professional ownership', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'deshi-session-evolution-'))
  const dataDirectory = path.join(directory, 'data')
  const originalCwd = process.cwd()
  const originalSecret = process.env.JWT_SECRET
  await fs.mkdir(dataDirectory)
  await fs.writeFile(path.join(dataDirectory, 'sessions.json'), JSON.stringify([
    createSession('owned', [
      createActivity(squatId, '2026-10-01T10:00:00.000Z', { repetitions: 5 })
    ]),
    createSession('other-professional', [
      createActivity(squatId, '2026-10-02T10:00:00.000Z', { repetitions: 99 })
    ], otherProfessionalId)
  ]))
  await fs.writeFile(path.join(dataDirectory, 'users.json'), JSON.stringify([
    { id: professionalId, profile: 'PROFESSIONAL' },
    { id: otherProfessionalId, profile: 'PROFESSIONAL' },
    { id: studentId, profile: 'STUDENT' }
  ]))
  await fs.writeFile(path.join(dataDirectory, 'revoked-tokens.json'), '[]')
  await fs.writeFile(path.join(dataDirectory, 'atividades.json'), JSON.stringify([
    { id: squatId, nome: 'Agachamento', modalidadeId: strengthModalityId }
  ]))
  await fs.writeFile(path.join(dataDirectory, 'atividades-personalizadas.json'), '[]')
  await fs.writeFile(path.join(dataDirectory, 'modalidades.json'), JSON.stringify([
    { id: strengthModalityId, nome: 'Força' }
  ]))
  await fs.writeFile(path.join(dataDirectory, 'profissional-modalidades.json'), '[]')

  const secret = 'us20-integration-test-secret'
  process.env.JWT_SECRET = secret
  process.chdir(directory)
  const app = Fastify()
  t.after(async () => {
    try {
      await app.close()
    } finally {
      process.chdir(originalCwd)
      if (originalSecret === undefined) {
        delete process.env.JWT_SECRET
      } else {
        process.env.JWT_SECRET = originalSecret
      }
      await fs.rm(directory, { recursive: true, force: true })
    }
  })

  const { sessionRoutes } = await import('../dist/modules/sessions/sessions.routes.js')
  await app.register(sessionRoutes)
  await app.ready()

  const tokenFor = (userId) => jwt.sign({ userId }, secret, {
    jwtid: randomUUID(),
    expiresIn: '1h'
  })
  const url = `/students/${studentId}/evolution`
  const unauthenticatedResponse = await app.inject({
    method: 'GET',
    url
  })
  const studentResponse = await app.inject({
    method: 'GET',
    url,
    headers: { authorization: `Bearer ${tokenFor(studentId)}` }
  })
  const response = await app.inject({
    method: 'GET',
    url,
    headers: { authorization: `Bearer ${tokenFor(professionalId)}` }
  })
  const filteredResponse = await app.inject({
    method: 'GET',
    url: `${url}?activityId=${squatId}&metric=repetitions`,
    headers: { authorization: `Bearer ${tokenFor(professionalId)}` }
  })

  assert.equal(unauthenticatedResponse.statusCode, 401)
  assert.equal(studentResponse.statusCode, 403)
  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json().evolution[0].points.map((point) => point.sessionId), ['owned'])
  assert.deepEqual(filteredResponse.json().evolution.map((entry) => entry.metric), ['repetitions'])
})
