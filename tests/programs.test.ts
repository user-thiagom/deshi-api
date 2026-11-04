import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import Fastify, { FastifyReply, FastifyRequest } from 'fastify'
import { ProgramRouteDependencies, programRoutes } from '../src/modules/programs/program.routes.js'
import { ProgramService } from '../src/modules/programs/program.service.js'
import { ProgramCatalogRepository } from '../src/modules/programs/repositories/program-catalog.repository.js'
import { ProgramRepository } from '../src/modules/programs/repositories/program.repository.js'
import { CreateProgramData, Program } from '../src/modules/programs/program.types.js'
import { User } from '../src/modules/users/users.types.js'

const PROFESSIONAL_ID = '00000000-0000-4000-8000-000000000001'
const STUDENT_ID = '00000000-0000-4000-8000-000000000002'
const UNKNOWN_ACTIVITY_ID = '00000000-0000-4000-8000-000000000099'
const MODALITY_ID = '00000000-0000-4000-8000-000000000010'
const ACTIVITY_ONE_ID = '00000000-0000-4000-8000-000000000011'
const ACTIVITY_TWO_ID = '00000000-0000-4000-8000-000000000012'
const input = {
    studentId: STUDENT_ID,
    name: 'Programa de teste',
    modalityId: MODALITY_ID,
    activityIds: [ACTIVITY_TWO_ID, ACTIVITY_ONE_ID]
}

class MemoryProgramRepository implements ProgramRepository {
    readonly created: Program[] = []

    async create(data: CreateProgramData): Promise<Program> {
        const program = { ...data, id: 'program-id', createdAt: new Date('2026-01-01T00:00:00Z') }
        this.created.push(program)
        return program
    }
}

class MemoryCatalogRepository implements ProgramCatalogRepository {
    linked = true
    modalitySelected = true
    readonly activities = new Map([
        [ACTIVITY_ONE_ID, { id: ACTIVITY_ONE_ID, modalidadeId: MODALITY_ID, origem: 'PADRAO' as const, profissionalId: null }],
        [ACTIVITY_TWO_ID, { id: ACTIVITY_TWO_ID, modalidadeId: MODALITY_ID, origem: 'PADRAO' as const, profissionalId: null }]
    ])

    async isStudentLinkedToProfessional(professionalId: string, studentId: string) {
        return this.linked && professionalId === PROFESSIONAL_ID && studentId === STUDENT_ID
    }

    async hasProfessionalModality(professionalId: string, modalityId: string) {
        return this.modalitySelected && professionalId === PROFESSIONAL_ID && modalityId === MODALITY_ID
    }

    async findActivity(activityId: string) {
        return this.activities.get(activityId) ?? null
    }
}

function createTestApp() {
    const programs = new MemoryProgramRepository()
    const catalog = new MemoryCatalogRepository()
    const student = {
        id: STUDENT_ID,
        name: 'Aluno',
        email: 'aluno@example.com',
        passwordHash: 'not-used',
        profile: 'STUDENT',
        createdAt: new Date(),
        updatedAt: new Date()
    } satisfies User
    const users = {
        findById: async (id: string) => id === STUDENT_ID ? student : null
    }
    const service = new ProgramService(programs, catalog, users)
    const dependencies: ProgramRouteDependencies = {
        programService: service,
        authenticate: async (request: FastifyRequest, reply: FastifyReply) => {
            if (request.headers.authorization !== 'Bearer test-token') {
                return reply.status(401).send({ message: 'Token de autenticação não informado.' })
            }
            request.user = { userId: PROFESSIONAL_ID, jti: 'test-jti', exp: 1 }
        },
        authorizeProfessional: async (request: FastifyRequest, reply: FastifyReply) => {
            if (request.user.userId !== PROFESSIONAL_ID) {
                return reply.status(403).send({ message: 'Você não tem permissão para acessar este recurso.' })
            }
        }
    }
    const app = Fastify()
    app.register(programRoutes, dependencies)
    return { app, programs, catalog }
}

let app: ReturnType<typeof createTestApp>['app']
let programs: MemoryProgramRepository
let catalog: MemoryCatalogRepository

beforeEach(async () => {
    const fixture = createTestApp()
    app = fixture.app
    programs = fixture.programs
    catalog = fixture.catalog
    await app.ready()
})

afterEach(async () => {
    await app.close()
})

function postProgram(body: unknown, authenticated = true) {
    return app.inject({
        method: 'POST',
        url: '/programs',
        headers: authenticated ? { authorization: 'Bearer test-token' } : {},
        payload: body
    })
}

test('creates a program with 201 and preserves activity order', async () => {
    const response = await postProgram(input)

    assert.equal(response.statusCode, 201)
    assert.equal(response.json().id, 'program-id')
    assert.equal(response.json().professionalId, PROFESSIONAL_ID)
    assert.deepEqual(response.json().activities, [
        { activityId: ACTIVITY_TWO_ID, order: 1 },
        { activityId: ACTIVITY_ONE_ID, order: 2 }
    ])
    assert.deepEqual(programs.created[0].activities, [
        { activityId: ACTIVITY_TWO_ID, order: 1 },
        { activityId: ACTIVITY_ONE_ID, order: 2 }
    ])
})

test('rejects missing required fields', async () => {
    const response = await postProgram({})
    assert.equal(response.statusCode, 400)
})

test('rejects unauthenticated requests', async () => {
    const response = await postProgram(input, false)
    assert.equal(response.statusCode, 401)
})

test('rejects a student not linked to the authenticated professional', async () => {
    catalog.linked = false
    const response = await postProgram(input)
    assert.equal(response.statusCode, 403)
})

test('rejects programs without activities', async () => {
    const response = await postProgram({ ...input, activityIds: [] })
    assert.equal(response.statusCode, 400)
})

test('rejects an activity missing from the catalog', async () => {
    const response = await postProgram({ ...input, activityIds: [UNKNOWN_ACTIVITY_ID] })
    assert.equal(response.statusCode, 404)
})

test('rejects a modality not selected by the professional', async () => {
    catalog.modalitySelected = false
    const response = await postProgram(input)
    assert.equal(response.statusCode, 404)
})

test('rejects an activity from another modality', async () => {
    catalog.activities.set(ACTIVITY_ONE_ID, {
        id: ACTIVITY_ONE_ID,
        modalidadeId: UNKNOWN_ACTIVITY_ID,
        origem: 'PADRAO',
        profissionalId: null
    })
    const response = await postProgram({ ...input, activityIds: [ACTIVITY_ONE_ID] })
    assert.equal(response.statusCode, 404)
})

test('rejects another professional\'s personalized activity', async () => {
    catalog.activities.set(ACTIVITY_ONE_ID, {
        id: ACTIVITY_ONE_ID,
        modalidadeId: MODALITY_ID,
        origem: 'PERSONALIZADA',
        profissionalId: '00000000-0000-4000-8000-000000000099'
    })
    const response = await postProgram({ ...input, activityIds: [ACTIVITY_ONE_ID] })
    assert.equal(response.statusCode, 404)
})

test('rejects a missing student', async () => {
    const response = await postProgram({ ...input, studentId: '00000000-0000-4000-8000-000000000003' })
    assert.equal(response.statusCode, 404)
})