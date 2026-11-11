import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { JsonUserRepository } from '../dist/modules/users/repositories/json-user.repository.js'
import { VinculoService } from '../dist/modules/vinculos/vinculos.service.js'

async function createUsersFile(t, users) {
    const directory = await mkdtemp(path.join(tmpdir(), 'deshi-users-batch-'))
    const filePath = path.join(directory, 'users.json')
    await writeFile(filePath, JSON.stringify(users))
    t.after(() => rm(directory, { recursive: true, force: true }))
    return filePath
}

function user(id, profile) {
    const now = '2026-01-01T00:00:00.000Z'

    return {
        id,
        profile,
        name: `Usuário ${id}`,
        email: `${id}@example.invalid`,
        passwordHash: 'synthetic-only',
        createdAt: now,
        updatedAt: now
    }
}


test('findByIds preserva ordem e repetições, retorna ausentes como null e lê uma vez', async (t) => {
    const first = user(randomUUID(), 'STUDENT')
    const second = user(randomUUID(), 'PROFESSIONAL')
    const filePath = await createUsersFile(t, [first, second])
    const repository = new JsonUserRepository(filePath)
    const originalReadFile = fs.readFile
    let reads = 0

    fs.readFile = async function (target, ...args) {
        if (path.resolve(target.toString()) === path.resolve(filePath)) reads++
        return originalReadFile.call(this, target, ...args)
    }

    try {
        const result = await repository.findByIds([
            second.id,
            'missing',
            first.id,
            second.id
        ])

        assert.deepEqual(result, [second, null, first, second])
        assert.equal(reads, 1)
    } finally {
        fs.readFile = originalReadFile
    }
})

test('findByIds retorna lista vazia sem ler arquivo', async () => {
    const repository = new JsonUserRepository(path.join(tmpdir(), randomUUID(), 'missing.json'))
    assert.deepEqual(await repository.findByIds([]), [])
})

test('listagens em lote preservam ordem e filtram por perfil', async (t) => {
    const professionalA = user(randomUUID(), 'PROFESSIONAL')
    const professionalB = user(randomUUID(), 'PROFESSIONAL')
    const student = user(randomUUID(), 'STUDENT')
    const filePath = await createUsersFile(t, [professionalA, professionalB, student])
    const userRepository = new JsonUserRepository(filePath)
    const vinculoRepository = {
        buscarAtivosPorProfissional: async () => [
            { alunoId: student.id },
            { alunoId: professionalA.id },
            { alunoId: 'missing' }
        ],
        buscarAtivosPorAluno: async () => [
            { profissionalId: professionalB.id },
            { profissionalId: student.id },
            { profissionalId: professionalA.id }
        ]
    }
    const service = new VinculoService(vinculoRepository, userRepository)

    assert.deepEqual(
        (await service.listarAlunosVinculados(professionalA.id)).map((item) => item.id),
        [student.id]
    )
    assert.deepEqual(
        (await service.listarProfissionaisVinculados(student.id)).map((item) => item.id),
        [professionalB.id, professionalA.id]
    )
})
