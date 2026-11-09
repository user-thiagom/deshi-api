import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import Fastify from 'fastify'
import jwt from 'jsonwebtoken'

const root = fileURLToPath(new URL('../', import.meta.url))
const secret = 'programs-test-secret'
const modalityId = 'd1b10e90-8d5c-4ad3-9d68-000000000001'
const activityIds = [
    'a7101d90-8d5c-4ad3-9d68-000000000001',
    'a7101d90-8d5c-4ad3-9d68-000000000002'
]

function token(userId) {
    return jwt.sign({ userId }, secret, { jwtid: randomUUID(), expiresIn: '1h' })
}

test('US10 — create programs over HTTP and persist isolated JSON data', { timeout: 60_000 }, async (t) => {
    const temporary = await fs.mkdtemp(path.join(root, 'tests', '.tmp-programs-'))
    const data = path.join(temporary, 'data')
    const professionalId = randomUUID()
    const otherProfessionalId = randomUUID()
    const studentId = randomUUID()
    const unlinkedStudentId = randomUUID()
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
                { id: professionalId, profile: 'PROFESSIONAL' },
                { id: otherProfessionalId, profile: 'PROFESSIONAL' },
                { id: studentId, profile: 'STUDENT' },
                { id: unlinkedStudentId, profile: 'STUDENT' }
            ]),
            writeJson('revoked-tokens.json', []),
            writeJson('programs.json', []),
            writeJson('vinculos.json', [{
                profissionalId: professionalId,
                alunoId: studentId,
                status: 'ATIVO'
            }]),
            writeJson('modalidades.json', [{ id: modalityId, nome: 'Musculação' }]),
            writeJson('profissional-modalidades.json', [{
                profissionalId: professionalId,
                modalidadeIds: [modalityId]
            }]),
            writeJson('atividades.json', activityIds.map((id) => ({
                id,
                modalidadeId: modalityId,
                origem: 'PADRAO',
                profissionalId: null
            }))),
            writeJson('atividades-personalizadas.json', [])
        ])

        process.env.JWT_SECRET = secret
        process.chdir(temporary)
        const { programRoutes } = await import('../dist/modules/programs/program.routes.js')
        app.register(programRoutes)
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
        const professionalToken = token(professionalId)
        const body = {
            alunoId: studentId,
            nome: 'Programa inicial',
            modalidadeId: modalityId,
            atividades: [activityIds[1], activityIds[0]]
        }

        await t.test('creates a linked student program with ordered activities and persists it', async () => {
            const response = await request('POST', '/programas', professionalToken, body)
            assert.equal(response.status, 201)
            assert.equal(response.body.profissionalId, professionalId)
            assert.equal(response.body.alunoId, studentId)
            assert.equal(response.body.nome, body.nome)
            assert.equal(response.body.modalidadeId, modalityId)
            assert.deepEqual(response.body.atividades.map(({ atividadeId, ordem }) => ({ atividadeId, ordem })), [
                { atividadeId: activityIds[1], ordem: 1 },
                { atividadeId: activityIds[0], ordem: 2 }
            ])
            assert.ok(response.body.criadoEm)

            const persisted = JSON.parse(await fs.readFile(path.join(data, 'programs.json'), 'utf8'))
            assert.equal(persisted.length, 1)
            assert.equal(persisted[0].id, response.body.id)
        })

        await t.test('rejects a missing token and a student creating a program', async () => {
            assert.equal((await request('POST', '/programas', undefined, body)).status, 401)
            assert.equal((await request('POST', '/programas', token(studentId), body)).status, 403)
        })

        await t.test('rejects invalid input, unlinked students, and unavailable modalities or activities', async () => {
            assert.equal((await request('POST', '/programas', professionalToken, {})).status, 400)
            assert.equal((await request('POST', '/programas', professionalToken, {
                ...body,
                alunoId: unlinkedStudentId
            })).status, 403)
            assert.equal((await request('POST', '/programas', professionalToken, {
                ...body,
                modalidadeId: randomUUID()
            })).status, 404)
            assert.equal((await request('POST', '/programas', professionalToken, {
                ...body,
                atividades: [randomUUID()]
            })).status, 404)
            assert.equal((await request('POST', '/programas', professionalToken, {
                ...body,
                atividades: []
            })).status, 400)
        })

        await t.test('lists only the authenticated student’s programs', async () => {
            const ownPrograms = await request('GET', '/programas', token(studentId))
            assert.equal(ownPrograms.status, 200)
            assert.equal(ownPrograms.body.length, 1)
            assert.equal(ownPrograms.body[0].alunoId, studentId)
            assert.deepEqual((await request('GET', '/programas', token(unlinkedStudentId))).body, [])
            assert.equal((await request('GET', '/programas')).status, 401)
        })

        assert.equal(JSON.parse(await fs.readFile(path.join(data, 'programs.json'), 'utf8')).length, 1)
    } finally {
        await app.close()
        process.chdir(originalCwd)
        if (previousSecret === undefined) delete process.env.JWT_SECRET
        else process.env.JWT_SECRET = previousSecret
        await fs.rm(temporary, { recursive: true, force: true })
    }
})
