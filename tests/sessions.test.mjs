import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Fastify from 'fastify'
import { JsonProgramRepository } from '../dist/modules/programs/repositories/json-program.repository.js'
import { SessionsService } from '../dist/modules/sessions/sessions.service.js'
import { sessionRoutes } from '../dist/modules/sessions/sessions.routes.js'

const STUDENT_ID = '00000000-0000-4000-8000-000000000001'
const OTHER_STUDENT_ID = '00000000-0000-4000-8000-000000000002'
const PROGRAM_ID = '00000000-0000-4000-8000-000000000003'
const program = {
    id: PROGRAM_ID,
    professionalId: '00000000-0000-4000-8000-000000000004',
    studentId: STUDENT_ID,
    name: 'Programa de teste',
    modalityId: '00000000-0000-4000-8000-000000000005',
    activities: [{ activityId: '00000000-0000-4000-8000-000000000006', order: 1 }],
    createdAt: '2026-01-01T00:00:00.000Z'
}

let app
let directory
let sessions

beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'deshi-sessions-test-'))
    const programsPath = path.join(directory, 'programs.json')
    await writeFile(programsPath, JSON.stringify([program]))

    const sessionRepository = {
        create: async (session) => {
            sessions.push(session)
            return session
        }
    }
    sessions = []
    const service = new SessionsService(
        new JsonProgramRepository(programsPath),
        sessionRepository
    )

    app = Fastify()
    await app.register(sessionRoutes, {
        sessionsService: service,
        authenticate: async (request) => {
            request.user = {
                userId: STUDENT_ID,
                jti: 'test-jti',
                exp: 1
            }
        }
    })
    await app.ready()
})

afterEach(async () => {
    await app.close()
    await rm(directory, { recursive: true, force: true })
})

function startSession(programId) {
    return app.inject({
        method: 'POST',
        url: '/sessions',
        payload: { programId }
    })
}

test('returns 404 when the requested program does not exist', async () => {
    const response = await startSession('00000000-0000-4000-8000-000000000099')

    assert.equal(response.statusCode, 404)
    assert.equal(response.json().message, 'Programa não encontrado.')
    assert.equal(sessions.length, 0)
})

test('returns 403 when the program belongs to another student', async () => {
    const contents = JSON.stringify([{ ...program, studentId: OTHER_STUDENT_ID }])
    await writeFile(path.join(directory, 'programs.json'), contents)

    const response = await startSession(PROGRAM_ID)

    assert.equal(response.statusCode, 403)
    assert.equal(response.json().message, 'Este programa não pertence ao aluno autenticado.')
    assert.equal(sessions.length, 0)
})

test('starts a session for the student who owns the program', async () => {
    const response = await startSession(PROGRAM_ID)

    assert.equal(response.statusCode, 201)
    assert.equal(response.json().programId, PROGRAM_ID)
    assert.equal(response.json().studentId, STUDENT_ID)
    assert.equal(sessions.length, 1)
})
