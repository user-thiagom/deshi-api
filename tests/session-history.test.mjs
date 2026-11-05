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

function createSession(id, startedAt, sessionProfessionalId = professionalId) {
  return {
    id,
    programId: '00000000-0000-4000-8000-000000000004',
    studentId,
    professionalId: sessionProfessionalId,
    startedAt: new Date(startedAt),
    status: 'COMPLETED',
    activities: []
  }
}

test('session repository persists sessions and student history is returned newest first', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'deshi-session-history-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))

  const repository = new JsonSessionRepository(path.join(directory, 'sessions.json'))
  await fs.writeFile(path.join(directory, 'sessions.json'), '[]')
  await repository.create(createSession('newer', '2026-11-01T10:00:00.000Z'))
  await repository.create(createSession('older', '2026-10-01T10:00:00.000Z'))

  const service = new SessionsService({}, repository, {})
  const sessions = await service.getStudentSessions(studentId)

  assert.deepEqual(sessions.map((session) => session.id), ['newer', 'older'])
  assert.equal((await repository.findById('older')).studentId, studentId)
})

test('professional history only returns that professional sessions for the requested student', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'deshi-session-route-'))
  const dataDirectory = path.join(directory, 'data')
  const originalCwd = process.cwd()
  const originalSecret = process.env.JWT_SECRET
  await fs.mkdir(dataDirectory)
  await fs.writeFile(path.join(dataDirectory, 'sessions.json'), JSON.stringify([
    createSession('other-professional', '2026-11-03T10:00:00.000Z', otherProfessionalId),
    createSession('newer', '2026-11-02T10:00:00.000Z'),
    { ...createSession('other-student', '2026-11-04T10:00:00.000Z'), studentId: otherProfessionalId },
    createSession('older', '2026-10-01T10:00:00.000Z')
  ]))
  await fs.writeFile(path.join(dataDirectory, 'users.json'), JSON.stringify([
    { id: professionalId, profile: 'PROFESSIONAL' },
    { id: otherProfessionalId, profile: 'PROFESSIONAL' },
    { id: studentId, profile: 'STUDENT' }
  ]))
  await fs.writeFile(path.join(dataDirectory, 'revoked-tokens.json'), '[]')

  const secret = 'us19-integration-test-secret'
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
  const url = `/students/${studentId}/sessions/history`

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

  assert.equal(unauthenticatedResponse.statusCode, 401)
  assert.equal(studentResponse.statusCode, 403)
  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json().map((session) => session.id), ['newer', 'older'])
  assert.ok(response.json().every((session) => session.professionalId === professionalId))
  assert.ok(response.json().every((session) => session.studentId === studentId))
})

test('professional history returns an empty list when the student has no sessions', async () => {
  const service = new SessionsService(
    {},
    { async findByStudentId() { return [] } },
    {}
  )

  assert.deepEqual(
    await service.getProfessionalStudentSessions(studentId, professionalId),
    []
  )
})

test('student history is empty when the student has no sessions', async () => {
  const service = new SessionsService(
    {},
    { async findByStudentId() { return [] } },
    {}
  )

  assert.deepEqual(await service.getStudentSessions(studentId), [])
})

test('opening a session returns it only to its owning professional', async (t) => {
  const { getSessionResultController } = await import('../dist/modules/sessions/sessions.controller.js')
  const session = createSession('session-to-open', '2026-11-01T10:00:00.000Z')
  const service = new SessionsService(
    {},
    { async findById(id) { return id === session.id ? session : null } },
    {}
  )
  const app = Fastify()
  t.after(() => app.close())

  app.get(
    '/sessions/:sessionId',
    {
      preHandler: async (request) => {
        request.user = { userId: request.headers['x-user-id'] }
      }
    },
    getSessionResultController(service)
  )

  const ownerResponse = await app.inject({
    method: 'GET',
    url: `/sessions/${session.id}`,
    headers: { 'x-user-id': professionalId }
  })
  const otherProfessionalResponse = await app.inject({
    method: 'GET',
    url: `/sessions/${session.id}`,
    headers: { 'x-user-id': otherProfessionalId }
  })

  assert.equal(ownerResponse.statusCode, 200)
  assert.equal(ownerResponse.json().id, session.id)
  assert.equal(otherProfessionalResponse.statusCode, 403)
})

test('session snapshots prefer program prescriptions and isolate them from later changes', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'deshi-session-snapshot-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  const sessionRepository = new JsonSessionRepository(path.join(directory, 'sessions.json'))
  await fs.writeFile(path.join(directory, 'sessions.json'), '[]')
  const configuredProgramValues = { sets: 3, repetitions: 10 }
  const prescribedProgramValues = { sets: 5, repetitions: 8 }
  const legacyConfiguredValues = { sets: 2, repetitions: 15 }
  const program = {
    id: 'program-id',
    professionalId,
    studentId,
    version: 2,
    activities: [
      { activityId: 'activity-legacy', order: 2 },
      {
        activityId: 'activity-1',
        order: 1,
        prescribed: prescribedProgramValues
      }
    ]
  }
  const service = new SessionsService(
    { async findById() { return program } },
    sessionRepository,
    {
      async listar() {
        return [{
          atividadeId: 'activity-1',
          profissionalId: professionalId,
          atualizadoEm: '2026-11-01T10:00:00.000Z',
          valores: configuredProgramValues
        }, {
          atividadeId: 'activity-legacy',
          profissionalId: professionalId,
          atualizadoEm: '2026-11-02T10:00:00.000Z',
          valores: legacyConfiguredValues
        }]
      }
    }
  )

  const createdSession = await service.startSession(program.id, studentId)
  program.activities[1].activityId = 'activity-2'
  prescribedProgramValues.sets = 99
  configuredProgramValues.sets = 88
  legacyConfiguredValues.sets = 77
  const session = await sessionRepository.findById(createdSession.id)

  assert.equal(session.programId, program.id)
  assert.equal(session.programVersion, program.version)
  assert.equal(session.studentId, studentId)
  assert.equal(session.professionalId, professionalId)
  assert.ok(session.startedAt instanceof Date)
  assert.deepEqual(
    session.activities.map(({ activityId }) => activityId),
    ['activity-1', 'activity-legacy']
  )
  assert.deepEqual(session.activities[0].prescribed, { sets: 5, repetitions: 8 })
  assert.deepEqual(session.activities[1].prescribed, { sets: 2, repetitions: 15 })
})
