import assert from 'node:assert/strict'
import { test } from 'node:test'
import Fastify from 'fastify'
import { createStartSessionController } from '../dist/modules/sessions/sessions.controller.js'
import { programRoutes } from '../dist/modules/programs/program.routes.js'

const PROGRAM_ID = 'program-id'
const STUDENT_ID = 'student-id'
const PROFESSIONAL_ID = 'professional-id'

test('GET /programs includes professionalName and keeps professionalId', async () => {
    const app = Fastify()
    const program = {
        id: 'program-id',
        professionalId: PROFESSIONAL_ID,
        professionalName: 'Profissional responsável',
        studentId: STUDENT_ID,
        name: 'Programa',
        modalityId: 'modality-id',
        activities: [],
        createdAt: new Date('2026-11-09T12:00:00.000Z')
    }

    await app.register(programRoutes, {
        programService: {
            findProgramsByStudent: async () => [program]
        },
        authenticate: async (request, reply) => {
            if (request.headers.authorization !== 'Bearer student-token') {
                return reply.code(401).send({ message: 'Não autenticado.' })
            }
            request.user = { userId: STUDENT_ID, jti: 'test', exp: 1 }
        },
        authorizeStudent: async (request, reply) => {
            if (request.user.userId !== STUDENT_ID) {
                return reply.code(403).send({ message: 'Acesso negado.' })
            }
        }
    })

    try {
        const response = await app.inject({
            method: 'GET',
            url: '/programs',
            headers: { authorization: 'Bearer student-token' }
        })

        assert.equal(response.statusCode, 200)
        assert.equal(response.json()[0].professionalId, PROFESSIONAL_ID)
        assert.equal(response.json()[0].professionalName, 'Profissional responsável')
        assert.equal('email' in response.json()[0], false)
        assert.equal('passwordHash' in response.json()[0], false)
    } finally {
        await app.close()
    }
})

test('POST /sessions response includes only the responsible professional name', async () => {
    const session = {
        id: 'session-id',
        programId: PROGRAM_ID,
        studentId: STUDENT_ID,
        professionalId: PROFESSIONAL_ID,
        startedAt: new Date('2026-11-09T12:00:00.000Z'),
        status: 'IN_PROGRESS',
        activities: []
    }
    const app = Fastify()
    app.post('/sessions', {
        preHandler: async (request, reply) => {
            if (request.headers.authorization !== 'Bearer student-token') {
                return reply.code(401).send({ message: 'Não autenticado.' })
            }
            request.user = { userId: STUDENT_ID, jti: 'test', exp: 1 }
        }
    }, createStartSessionController({
        startSession: async (programId, studentId) => {
            assert.equal(programId, PROGRAM_ID)
            assert.equal(studentId, STUDENT_ID)
            return session
        }
    }, {
        findById: async (userId) => userId === PROFESSIONAL_ID ? {
            id: PROFESSIONAL_ID,
            name: 'Profissional responsável',
            email: 'privado@example.com',
            passwordHash: 'segredo',
            profile: 'PROFESSIONAL',
            createdAt: new Date(),
            updatedAt: new Date()
        } : null
    }))

    try {
        const response = await app.inject({
            method: 'POST',
            url: '/sessions',
            headers: { authorization: 'Bearer student-token' },
            payload: { programId: PROGRAM_ID }
        })

        assert.equal(response.statusCode, 201)
        assert.equal(response.json().professionalId, PROFESSIONAL_ID)
        assert.equal(response.json().professionalName, 'Profissional responsável')
        assert.equal('email' in response.json(), false)
        assert.equal('passwordHash' in response.json(), false)
    } finally {
        await app.close()
    }
})
