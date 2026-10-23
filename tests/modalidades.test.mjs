import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import Fastify from 'fastify'
import jwt from 'jsonwebtoken'

const raiz = fileURLToPath(new URL('../', import.meta.url))
const segredo = 'segredo-exclusivo-dos-testes-de-modalidades'
const profissionalA = randomUUID()
const profissionalB = randomUUID()
const estudante = randomUUID()

function token(userId, opcoes = {}) {
    return jwt.sign({ userId }, segredo, { jwtid: randomUUID(), expiresIn: '1h', ...opcoes })
}

test('modalidades — HTTP injetado, autorização e persistência JSON isolada', async (t) => {
    const diretorio = await fs.mkdtemp(path.join(raiz, 'tests', '.tmp-modalidades-'))
    const data = path.join(diretorio, 'data')
    const cwdOriginal = process.cwd()
    const segredoAnterior = process.env.JWT_SECRET
    const app = Fastify()

    await fs.mkdir(data)
    await fs.copyFile(path.join(raiz, 'data/modalidades.json'), path.join(data, 'modalidades.json'))
    await fs.writeFile(path.join(data, 'profissional-modalidades.json'), JSON.stringify([
        { profissionalId: profissionalB, modalidadeIds: [] }
    ]))
    await fs.writeFile(path.join(data, 'users.json'), JSON.stringify([
        { id: profissionalA, profile: 'PROFESSIONAL' },
        { id: profissionalB, profile: 'PROFESSIONAL' },
        { id: estudante, profile: 'STUDENT' }
    ]))
    await fs.writeFile(path.join(data, 'revoked-tokens.json'), '[]')

    process.env.JWT_SECRET = segredo
    process.chdir(diretorio)

    t.after(async () => {
        await app.close()
        process.chdir(cwdOriginal)
        if (segredoAnterior === undefined) delete process.env.JWT_SECRET
        else process.env.JWT_SECRET = segredoAnterior
        await fs.rm(diretorio, { recursive: true, force: true })
    })

    const { modalidadeRoutes } = await import('../dist/modules/modalidades/modalidades.routes.js')
    app.register(modalidadeRoutes)
    await app.ready()

    const requisitar = (method, url, userId = profissionalA, body, credencial) => app.inject({
        method,
        url,
        ...(credencial ? { headers: { authorization: `Bearer ${credencial}` } } :
            userId ? { headers: { authorization: `Bearer ${token(userId)}` } } : {}),
        ...(body === undefined ? {} : { payload: body })
    })
    const arquivoSelecoes = path.join(data, 'profissional-modalidades.json')
    const catalogo = JSON.parse(await fs.readFile(path.join(data, 'modalidades.json'), 'utf8'))
    const ids = catalogo.slice(0, 3).map(({ id }) => id)
    const lerSelecoes = async () => JSON.parse(await fs.readFile(arquivoSelecoes, 'utf8'))

    await t.test('lista o catálogo autenticado sem campos internos', async () => {
        const resposta = await requisitar('GET', '/modalidades')
        assert.equal(resposta.statusCode, 200)
        assert.deepEqual(resposta.json(), catalogo)
        assert.ok(resposta.json().every((modalidade) => Object.keys(modalidade).sort().join(',') === 'id,nome'))
    })

    await t.test('profissional começa sem modalidades e consegue selecionar várias', async () => {
        assert.deepEqual((await requisitar('GET', '/modalidades/minhas')).json(), [])

        const resposta = await requisitar('PUT', '/modalidades/minhas', profissionalA, { modalidadeIds: [ids[1], ids[0]] })
        assert.equal(resposta.statusCode, 200)
        assert.deepEqual(resposta.json(), catalogo.slice(0, 2))
        assert.deepEqual((await requisitar('GET', '/modalidades/minhas')).json(), catalogo.slice(0, 2))
        assert.deepEqual(await lerSelecoes(), [
            { profissionalId: profissionalB, modalidadeIds: [] },
            { profissionalId: profissionalA, modalidadeIds: ids.slice(0, 2) }
        ])
    })

    await t.test('PUT substitui a seleção anterior sem afetar outros profissionais', async () => {
        const resposta = await requisitar('PUT', '/modalidades/minhas', profissionalA, { modalidadeIds: [ids[2]] })
        assert.equal(resposta.statusCode, 200)
        assert.deepEqual(resposta.json(), [catalogo[2]])
        assert.deepEqual((await requisitar('GET', '/modalidades/minhas', profissionalA)).json(), [catalogo[2]])
        assert.deepEqual((await requisitar('GET', '/modalidades/minhas', profissionalB)).json(), [])
        assert.deepEqual(await lerSelecoes(), [
            { profissionalId: profissionalB, modalidadeIds: [] },
            { profissionalId: profissionalA, modalidadeIds: [ids[2]] }
        ])
    })

    await t.test('requisições inválidas retornam 400 e não alteram a seleção', async () => {
        const invalidos = [
            ['corpo ausente', undefined],
            ['null', null],
            ['objeto vazio', {}],
            ['lista vazia', { modalidadeIds: [] }],
            ['valor que não é lista', { modalidadeIds: ids[0] }],
            ['UUID inválido', { modalidadeIds: ['abc'] }],
            ['modalidade inexistente', { modalidadeIds: [randomUUID()] }],
            ['modalidade repetida', { modalidadeIds: [ids[0], ids[0]] }],
            ['campo extra', { modalidadeIds: [ids[0]], profissionalId: profissionalB }]
        ]

        for (const [nome, body] of invalidos) {
            const antes = await fs.readFile(arquivoSelecoes, 'utf8')
            const resposta = await requisitar('PUT', '/modalidades/minhas', profissionalA, body)
            assert.equal(resposta.statusCode, 400, nome)
            assert.equal(await fs.readFile(arquivoSelecoes, 'utf8'), antes, nome)
        }
    })

    await t.test('autenticação e perfil protegem todas as rotas', async () => {
        for (const [method, url, body] of [
            ['GET', '/modalidades'],
            ['GET', '/modalidades/minhas'],
            ['PUT', '/modalidades/minhas', { modalidadeIds: [ids[0]] }]
        ]) {
            assert.equal((await requisitar(method, url, null, body)).statusCode, 401)
            assert.equal((await requisitar(method, url, estudante, body)).statusCode, 403)
            assert.equal((await requisitar(method, url, profissionalA, body, 'token-invalido')).statusCode, 401)
        }
    })

    await t.test('token revogado e usuário inexistente não acessam as rotas', async () => {
        const revogado = token(profissionalA)
        const payload = jwt.verify(revogado, segredo)
        await fs.writeFile(path.join(data, 'revoked-tokens.json'), JSON.stringify([
            { jti: payload.jti, expiresAt: new Date(payload.exp * 1000).toISOString() }
        ]))
        const antes = await fs.readFile(arquivoSelecoes, 'utf8')

        assert.equal((await requisitar('GET', '/modalidades/minhas', profissionalA, undefined, revogado)).statusCode, 401)
        assert.equal((await requisitar('PUT', '/modalidades/minhas', profissionalA, { modalidadeIds: [ids[0]] }, token(randomUUID()))).statusCode, 401)
        assert.equal(await fs.readFile(arquivoSelecoes, 'utf8'), antes)
    })
})
