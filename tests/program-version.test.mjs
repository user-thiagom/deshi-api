import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

import { JsonProgramRepository } from '../dist/modules/programs/repositories/json-program.repository.js'
import { JsonSessionRepository } from '../dist/modules/sessions/repositories/json-session.repository.js'
import { SessionsService } from '../dist/modules/sessions/sessions.service.js'

const professionalId = '00000000-0000-4000-8000-000000000001'
const studentId = '00000000-0000-4000-8000-000000000002'
const modalityId = '00000000-0000-4000-8000-000000000003'
const activityId = '00000000-0000-4000-8000-000000000004'

async function createRepositories(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'deshi-program-version-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))

  const programsPath = path.join(directory, 'programs.json')
  const sessionsPath = path.join(directory, 'sessions.json')
  await fs.writeFile(programsPath, '[]')
  await fs.writeFile(sessionsPath, '[]')

  return {
    programs: new JsonProgramRepository(programsPath),
    sessions: new JsonSessionRepository(sessionsPath),
    programsPath
  }
}

function createProgramData() {
  return {
    professionalId,
    studentId,
    name: 'Programa inicial',
    modalityId,
    activities: [{ activityId, order: 1 }]
  }
}

test('new programs start at version 1 and effective updates increment exactly once', async (t) => {
  const { programs } = await createRepositories(t)
  const created = await programs.create(createProgramData())

  assert.equal(created.version, 1)

  const updated = await programs.update({
    ...created,
    name: 'Programa atualizado',
    version: 99
  })
  assert.equal(updated.version, 2)

  const unchanged = await programs.update({
    ...updated,
    version: 1
  })
  assert.equal(unchanged.version, 2)

  const secondUpdate = await programs.update({
    ...unchanged,
    activities: [{ activityId, order: 2 }]
  })
  assert.equal(secondUpdate.version, 3)
})

test('program updates reject missing or invalid activities without changing persisted data', async (t) => {
  const { programs } = await createRepositories(t)
  const created = await programs.create(createProgramData())

  await assert.rejects(
    programs.update({ ...created, activities: undefined }),
    { name: 'TypeError', message: 'Atividades do programa inválidas.' }
  )
  await assert.rejects(
    programs.update({ ...created, activities: [{ activityId: '', order: 1 }] }),
    { name: 'TypeError', message: 'Atividades do programa inválidas.' }
  )

  const persisted = await programs.findById(created.id)
  assert.equal(persisted.version, 1)
  assert.deepEqual(persisted.activities, created.activities)
})

test('legacy programs default to version 1 and sessions retain their version and snapshots', async (t) => {
  const { programs, sessions, programsPath } = await createRepositories(t)
  const legacyProgram = {
    id: 'legacy-program',
    ...createProgramData(),
    createdAt: '2026-01-01T00:00:00.000Z'
  }
  await fs.writeFile(programsPath, JSON.stringify([legacyProgram]))

  const loadedProgram = await programs.findById(legacyProgram.id)
  assert.equal(loadedProgram.version, 1)

  let prescribedValues = { series: 3, repetitions: 10 }
  const service = new SessionsService(
    programs,
    sessions,
    {
      async listar() {
        return [{
          atividadeId: activityId,
          profissionalId: professionalId,
          atualizadoEm: '2026-11-01T10:00:00.000Z',
          valores: prescribedValues
        }]
      }
    }
  )

  const previousSession = await service.startSession(legacyProgram.id, studentId)
  assert.equal(previousSession.programVersion, 1)
  assert.equal(previousSession.programId, legacyProgram.id)
  assert.equal(previousSession.studentId, studentId)
  assert.equal(previousSession.professionalId, professionalId)
  assert.deepEqual(previousSession.activities[0].prescribed, { series: 3, repetitions: 10 })

  const changedProgram = await programs.update({
    ...loadedProgram,
    name: 'Programa atualizado',
    activities: [
      { activityId, order: 1 },
      { activityId: '00000000-0000-4000-8000-000000000005', order: 2 }
    ]
  })
  prescribedValues = { series: 8, repetitions: 12 }
  await new Promise((resolve) => setTimeout(resolve, 5))
  const nextSession = await service.startSession(legacyProgram.id, studentId)
  const persistedPreviousSession = await sessions.findById(previousSession.id)

  assert.equal(changedProgram.version, 2)
  assert.equal(nextSession.programVersion, 2)
  assert.equal(nextSession.activities.length, 2)
  assert.equal(persistedPreviousSession.programVersion, 1)
  assert.equal(persistedPreviousSession.activities.length, 1)
  assert.deepEqual(persistedPreviousSession.activities[0].prescribed, {
    series: 3,
    repetitions: 10
  })
  const history = await service.getStudentSessions(studentId)
  assert.deepEqual(
    history.map((session) => session.programVersion),
    [2, 1]
  )
})
