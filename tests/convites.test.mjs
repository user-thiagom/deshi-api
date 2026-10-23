import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import Fastify from 'fastify'
import jwt from 'jsonwebtoken'
import { ConviteService } from '../dist/modules/vinculos/convite.service.js'
import { VinculoService } from '../dist/modules/vinculos/vinculos.service.js'
import { JsonConviteRepository } from '../dist/modules/vinculos/repositories/json-convite.repository.js'
import { JsonVinculoRepository } from '../dist/modules/vinculos/repositories/json-vinculo.repository.js'
import { JsonUserRepository } from '../dist/modules/users/repositories/json-user.repository.js'
import { ConvitePendenteJaExistenteError, FalhaRollbackConviteError } from '../dist/modules/vinculos/convite.errors.js'
import { VinculoJaExistenteError } from '../dist/modules/vinculos/vinculos.errors.js'

const segredo = 'segredo-exclusivo-testes-convites'
const profissional = randomUUID()
const outroProfissional = randomUUID()
const aluno = randomUUID()
const outroAluno = randomUUID()
const usuarios = [
    [profissional, 'PROFESSIONAL'], [outroProfissional, 'PROFESSIONAL'],
    [aluno, 'STUDENT'], [outroAluno, 'STUDENT']
].map(([id, profile]) => ({
    id, profile, name: `Usuário ${id}`, email: `${id}@teste.local`,
    passwordHash: 'hash-que-nao-pode-vazar', createdAt: new Date(), updatedAt: new Date()
}))

const ler = async (arquivo) => JSON.parse(await readFile(arquivo, 'utf8'))
const gravar = (arquivo, dados) => writeFile(arquivo, JSON.stringify(dados))

async function contexto(t) {
    const cwdOriginal = process.cwd()
    const diretorio = await mkdtemp(path.join(tmpdir(), 'deshi-convites-test-'))


        t.after(async () => {
        const atual = process.cwd()

        if (
            atual === diretorio ||
            atual.startsWith(diretorio + path.sep)
        ) {
            process.chdir(cwdOriginal)
        }

        await rm(diretorio, {
            recursive: true,
            force: true,
            maxRetries: 10,
            retryDelay: 200
        })
    })



    const data = path.join(diretorio, 'data')
    await mkdir(data)
    const arquivoConvites = path.join(data, 'convites.json')
    const arquivoVinculos = path.join(data, 'vinculos.json')
    const arquivoUsuarios = path.join(data, 'users.json')
    const reset = async () => {
        await gravar(arquivoConvites, [])
        await gravar(arquivoVinculos, [])
        await gravar(arquivoUsuarios, usuarios)
        await gravar(path.join(data, 'revoked-tokens.json'), [])
    }
    await reset()
    const convites = new JsonConviteRepository(arquivoConvites)
    const vinculos = new JsonVinculoRepository(arquivoVinculos)
    const users = new JsonUserRepository(arquivoUsuarios)
    const service = new ConviteService(convites, vinculos, users)
    const vinculoService = new VinculoService(vinculos, users)
    return {
        diretorio, data, arquivoConvites, arquivoVinculos, arquivoUsuarios, reset,
        convites, vinculos, users, service, vinculoService
    }
}

function token(userId, opcoes = {}) {
    return jwt.sign({ userId }, segredo, { jwtid: randomUUID(), expiresIn: '1h', ...opcoes })
}

// Injeta as rotas reais, com JWT e autorização reais; todos os JSONs ficam em /tmp.
test('convites e regressão dos vínculos — HTTP', async (t) => {
    const c = await contexto(t)
    const cwd = process.cwd()
    const segredoAnterior = process.env.JWT_SECRET
    process.env.JWT_SECRET = segredo
    process.chdir(c.diretorio)
    const app = Fastify()


    t.after(async () => {
        try {
            await app.close()
        } finally {
            process.chdir(cwd)

            if (segredoAnterior === undefined) {
                delete process.env.JWT_SECRET
            } else {
                process.env.JWT_SECRET = segredoAnterior
            }

            await rm(c.diretorio, { recursive: true, force: true })
        }
    })


    const { conviteRoutes } = await import('../dist/modules/vinculos/convite.routes.js')
    const { vinculoRoutes } = await import('../dist/modules/vinculos/vinculos.routes.js')
    app.register(conviteRoutes)
    app.register(vinculoRoutes)
    await app.ready()
    t.beforeEach(c.reset)
    const requisitar = (method, url, userId = profissional, payload, credencial) => app.inject({
        method, url,
        headers: { authorization: `Bearer ${credencial ?? token(userId)}` },
        ...(payload === undefined ? {} : { payload })
    })
    const criar = (p = profissional, a = aluno) => requisitar('POST', '/vinculos/convites', p, { alunoId: a })
    const recurso = (codigo) => `/vinculos/convites/${codigo}`
    const snapshot = async () => [await readFile(c.arquivoConvites, 'utf8'), await readFile(c.arquivoVinculos, 'utf8')]

    for (const [nome, payload] of [
        ['ausente', undefined], ['null', null], ['array', []], ['sem aluno', {}],
        ['UUID inválido', { alunoId: 'abc' }], ['tipo inválido', { alunoId: 10 }],
        ['profissional forjado', { alunoId: aluno, profissionalId: outroProfissional }],
        ['status forjado', { alunoId: aluno, status: 'ACEITO' }],
        ['código forjado', { alunoId: aluno, codigo: 'ABCDEFGH' }]
    ]) {
        await t.test(`criação: ${nome} → 400 sem gravar`, async () => {
            const antes = await snapshot()
            const resposta = await requisitar('POST', '/vinculos/convites', profissional, payload)
            assert.equal(resposta.statusCode, 400)
            assert.deepEqual(await snapshot(), antes)
        })
    }

    for (const codigo of ['abc', 'abcdefgh', 'ABCDEFG0', 'ABCDEFGHI', 'ABC%20EFGH']) {
        await t.test(`código inválido ${codigo} → 400 em consulta, aceite e recusa`, async () => {
            const antes = await snapshot()
            for (const [method, sufixo] of [['GET', ''], ['POST', '/aceitar'], ['POST', '/recusar']]) {
                assert.equal((await requisitar(method, recurso(codigo) + sufixo, aluno)).statusCode, 400)
            }
            assert.deepEqual(await snapshot(), antes)
        })
    }

    await t.test('aluno ausente → 404; perfil incorreto e auto vínculo → 400', async () => {
        assert.equal((await criar(profissional, randomUUID())).statusCode, 404)
        assert.equal((await criar(profissional, outroProfissional)).statusCode, 400)
        assert.equal((await criar(profissional, profissional)).statusCode, 400)
        assert.deepEqual(await ler(c.arquivoConvites), [])
    })

    await t.test('201 individual, código seguro, sete dias, GET sem gravação e aceite único', async () => {
        const inicio = Date.now()
        const resposta = await criar()
        assert.equal(resposta.statusCode, 201)
        const convite = resposta.json()
        assert.match(convite.codigo, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/)
        assert.equal(convite.profissionalId, profissional)
        assert.equal(convite.alunoId, aluno)
        assert.equal(convite.status, 'PENDENTE')
        assert.ok(Date.parse(convite.expiraEm) >= inicio + 7 * 86400000)
        assert.ok(Date.parse(convite.expiraEm) <= Date.now() + 7 * 86400000)
        assert.deepEqual(await ler(c.arquivoVinculos), [])
        const antes = await snapshot()
        const consulta = await requisitar('GET', recurso(convite.codigo), aluno)
        assert.equal(consulta.statusCode, 200)
        assert.equal(consulta.json().profissional.id, profissional)
        assert.equal(consulta.json().profissional.passwordHash, undefined)
        assert.deepEqual(await snapshot(), antes)
        const aceite = await requisitar('POST', recurso(convite.codigo) + '/aceitar', aluno)
        assert.equal(aceite.statusCode, 200)
        assert.equal(aceite.json().status, 'ACEITO')
        const vinculos = await ler(c.arquivoVinculos)
        assert.equal(vinculos.length, 1)
        assert.equal(vinculos[0].status, 'ATIVO')
        assert.equal(vinculos[0].profissionalId, profissional)
        assert.equal(vinculos[0].alunoId, aluno)
        for (const [method, sufixo] of [['GET', ''], ['POST', '/aceitar'], ['POST', '/recusar']]) {
            assert.equal((await requisitar(method, recurso(convite.codigo) + sufixo, aluno)).statusCode, 409)
        }
        assert.equal((await ler(c.arquivoVinculos)).length, 1)
    })

    await t.test('somente destinatário consulta/aceita/recusa → 403 sem mutação', async () => {
        const convite = (await criar()).json()
        const antes = await snapshot()
        for (const [method, sufixo] of [['GET', ''], ['POST', '/aceitar'], ['POST', '/recusar']]) {
            assert.equal((await requisitar(method, recurso(convite.codigo) + sufixo, outroAluno)).statusCode, 403)
        }
        assert.deepEqual(await snapshot(), antes)
    })

    await t.test('código válido inexistente → 404 nas três operações', async () => {
        for (const [method, sufixo] of [['GET', ''], ['POST', '/aceitar'], ['POST', '/recusar']]) {
            assert.equal((await requisitar(method, recurso('ABCDEFGH') + sufixo, aluno)).statusCode, 404)
        }
    })

    await t.test('recusa não cria vínculo; convite recusado fica indisponível e permite novo', async () => {
        const convite = (await criar()).json()
        const resposta = await requisitar('POST', recurso(convite.codigo) + '/recusar', aluno)
        assert.equal(resposta.statusCode, 200)
        assert.equal(resposta.json().status, 'RECUSADO')
        assert.deepEqual(await ler(c.arquivoVinculos), [])
        for (const [method, sufixo] of [['GET', ''], ['POST', '/aceitar'], ['POST', '/recusar']]) {
            assert.equal((await requisitar(method, recurso(convite.codigo) + sufixo, aluno)).statusCode, 409)
        }
        assert.equal((await criar()).statusCode, 201)
    })

    for (const acao of ['aceitar', 'recusar']) {
        await t.test(`expiração: GET não escreve, ${acao} persiste EXPIRADO e retorna 410`, async () => {
            const convite = (await criar()).json()
            convite.expiraEm = new Date(Date.now() - 1).toISOString()
            await gravar(c.arquivoConvites, [convite])
            const antes = await snapshot()
            assert.equal((await requisitar('GET', recurso(convite.codigo), aluno)).statusCode, 410)
            assert.deepEqual(await snapshot(), antes)
            assert.equal((await requisitar('POST', recurso(convite.codigo) + `/${acao}`, outroAluno)).statusCode, 403)
            assert.deepEqual(await snapshot(), antes)
            assert.equal((await requisitar('POST', recurso(convite.codigo) + `/${acao}`, aluno)).statusCode, 410)
            assert.equal((await ler(c.arquivoConvites))[0].status, 'EXPIRADO')
            assert.deepEqual(await ler(c.arquivoVinculos), [])
            assert.equal((await requisitar('GET', recurso(convite.codigo), aluno)).statusCode, 410)
            assert.equal((await criar()).statusCode, 201)
        })
    }

    await t.test('pendente vencido não bloqueia novo; criação não altera convite antigo', async () => {
        const convite = (await criar()).json()
        convite.expiraEm = new Date(Date.now() - 1).toISOString()
        await gravar(c.arquivoConvites, [convite])
        assert.equal((await criar()).statusCode, 201)
        assert.deepEqual((await ler(c.arquivoConvites))[0], convite)
    })

    await t.test('pendente válido duplicado → 409; outras duplas permanecem independentes', async () => {
        assert.equal((await criar()).statusCode, 201)
        const antes = await snapshot()
        assert.equal((await criar()).statusCode, 409)
        assert.deepEqual(await snapshot(), antes)
        assert.equal((await criar(outroProfissional, aluno)).statusCode, 201)
        assert.equal((await criar(profissional, outroAluno)).statusCode, 201)
    })

    for (const status of ['PENDENTE', 'ATIVO']) {
        await t.test(`vínculo ${status} impede criação e aceite do convite → 409`, async () => {
            const convite = (await criar()).json()
            await c.vinculos.criar({ profissionalId: profissional, alunoId: aluno, status })
            const antes = await snapshot()
            assert.equal((await criar()).statusCode, 409)
            assert.equal((await requisitar('POST', recurso(convite.codigo) + '/aceitar', aluno)).statusCode, 409)
            assert.deepEqual(await snapshot(), antes)
        })
    }

    await t.test('vínculo RECUSADO permite convite e vínculo de outro profissional não bloqueia', async () => {
        await c.vinculos.criar({ profissionalId: profissional, alunoId: aluno, status: 'RECUSADO' })
        await c.vinculos.criar({ profissionalId: outroProfissional, alunoId: aluno, status: 'ATIVO' })
        const resposta = await criar()
        assert.equal(resposta.statusCode, 201)
        assert.equal((await requisitar('POST', recurso(resposta.json().codigo) + '/aceitar', aluno)).statusCode, 200)
        const lista = await requisitar('GET', '/vinculos/profissionais', aluno)
        assert.equal(lista.statusCode, 200)
        assert.deepEqual(new Set(lista.json().map((p) => p.id)), new Set([profissional, outroProfissional]))
        assert.ok(lista.json().every((p) => !('passwordHash' in p)))
    })

    await t.test('JWT e perfis protegem todas as rotas de convite', async () => {
        const convite = (await criar()).json()
        const operacoes = [
            ['POST', '/vinculos/convites', profissional, aluno, { alunoId: aluno }],
            ['GET', recurso(convite.codigo), aluno, profissional],
            ['POST', recurso(convite.codigo) + '/aceitar', aluno, profissional],
            ['POST', recurso(convite.codigo) + '/recusar', aluno, profissional]
        ]
        const antes = await snapshot()
        for (const [method, url, correto, errado, payload] of operacoes) {
            assert.equal((await app.inject({ method, url, payload })).statusCode, 401)
            for (const credencial of ['invalido', token(correto, { expiresIn: -1 }), token(randomUUID())]) {
                assert.equal((await requisitar(method, url, correto, payload, credencial)).statusCode, 401)
            }
            assert.equal((await requisitar(method, url, errado, payload)).statusCode, 403)
        }
        assert.deepEqual(await snapshot(), antes)
    })

    await t.test('tokens revogados → 401 nas quatro operações, sem alterar a feature', async () => {
        const convite = (await criar()).json()
        const antes = await snapshot()
        for (const [method, url, userId, payload] of [
            ['POST', '/vinculos/convites', profissional, { alunoId: aluno }],
            ['GET', recurso(convite.codigo), aluno],
            ['POST', recurso(convite.codigo) + '/aceitar', aluno],
            ['POST', recurso(convite.codigo) + '/recusar', aluno]
        ]) {
            const credencial = token(userId)
            const { jti, exp } = jwt.decode(credencial)
            await gravar(path.join(c.data, 'revoked-tokens.json'), [{ jti, expiresAt: new Date(exp * 1000) }])
            assert.equal((await requisitar(method, url, userId, payload, credencial)).statusCode, 401)
        }
        assert.deepEqual(await snapshot(), antes)
    })

    for (const falha of ['throw', 'null']) {
        await t.test(`falha de atualização (${falha}) → 500 e rollback no fluxo HTTP`, async (t) => {
            const convite = (await criar()).json()
            t.mock.method(JsonConviteRepository.prototype, 'atualizar', async () => {
                if (falha === 'null') return null
                throw new Error('erro interno secreto')
            })
            const resposta = await requisitar('POST', recurso(convite.codigo) + '/aceitar', aluno)
            assert.equal(resposta.statusCode, 500)
            assert.deepEqual(resposta.json(), { mensagem: 'Erro interno ao processar convite.' })
            assert.deepEqual(await ler(c.arquivoVinculos), [])
            assert.equal((await ler(c.arquivoConvites))[0].status, 'PENDENTE')
        })
    }

    await t.test('rollback malsucedido → 500 com aviso de verificação manual', async (t) => {
        const convite = (await criar()).json()
        t.mock.method(JsonConviteRepository.prototype, 'atualizar', async () => null)
        t.mock.method(JsonVinculoRepository.prototype, 'remover', async () => false)
        const resposta = await requisitar('POST', recurso(convite.codigo) + '/aceitar', aluno)
        assert.equal(resposta.statusCode, 500)
        assert.match(resposta.json().mensagem, /verificação manual/)
        assert.equal((await ler(c.arquivoVinculos)).length, 1)
        assert.equal((await ler(c.arquivoConvites))[0].status, 'PENDENTE')
    })

    await t.test('falha ao persistir recusa ou expiração → 500, sem fingir sucesso', async (t) => {
        const convite = (await criar()).json()
        t.mock.method(JsonConviteRepository.prototype, 'atualizar', async () => null)
        assert.equal((await requisitar('POST', recurso(convite.codigo) + '/recusar', aluno)).statusCode, 500)
        convite.expiraEm = new Date(Date.now() - 1).toISOString()
        await gravar(c.arquivoConvites, [convite])
        assert.equal((await requisitar('POST', recurso(convite.codigo) + '/aceitar', aluno)).statusCode, 500)
        assert.deepEqual(await ler(c.arquivoConvites), [convite])
        assert.deepEqual(await ler(c.arquivoVinculos), [])
    })

    await t.test('profissional removido não permite consulta nem aceite', async () => {
        const convite = (await criar()).json()
        await gravar(c.arquivoUsuarios, usuarios.filter((u) => u.id !== profissional))
        for (const [method, sufixo] of [['GET', ''], ['POST', '/aceitar']]) {
            assert.equal((await requisitar(method, recurso(convite.codigo) + sufixo, aluno)).statusCode, 404)
        }
        assert.deepEqual(await ler(c.arquivoVinculos), [])
    })

    await t.test('JSON inválido → 500 genérico sem sobrescrever dados ou expor erro interno', async () => {
        await writeFile(c.arquivoConvites, 'conteudo-invalido-secreto')
        const antes = await snapshot()
        for (const [method, url, userId, payload] of [
            ['POST', '/vinculos/convites', profissional, { alunoId: aluno }],
            ['GET', recurso('ABCDEFGH'), aluno],
            ['POST', recurso('ABCDEFGH') + '/aceitar', aluno],
            ['POST', recurso('ABCDEFGH') + '/recusar', aluno]
        ]) {
            const resposta = await requisitar(method, url, userId, payload)
            assert.equal(resposta.statusCode, 500)
            assert.deepEqual(resposta.json(), { mensagem: 'Erro interno ao processar convite.' })
        }
        assert.deepEqual(await snapshot(), antes)
    })

    await t.test('regressão: solicitação, posse, duplicidade, recusa, aceite e listagens', async () => {
        assert.equal((await requisitar('POST', '/vinculos', profissional, { alunoId: 'invalido' })).statusCode, 400)
        assert.equal((await requisitar('POST', '/vinculos', profissional, { alunoId: profissional })).statusCode, 400)
        assert.equal((await requisitar('POST', '/vinculos', profissional, { alunoId: randomUUID() })).statusCode, 404)
        assert.equal((await requisitar('POST', '/vinculos', aluno, { alunoId: outroAluno })).statusCode, 403)
        assert.equal((await app.inject({ method: 'POST', url: '/vinculos', payload: { alunoId: aluno } })).statusCode, 401)
        const criarSolicitacao = () => requisitar('POST', '/vinculos', profissional, { alunoId: aluno })
        const primeira = await criarSolicitacao()
        assert.equal(primeira.statusCode, 201)
        const pendente = primeira.json()
        assert.equal(pendente.status, 'PENDENTE')
        assert.equal((await criarSolicitacao()).statusCode, 409)
        assert.deepEqual((await requisitar('GET', '/vinculos/alunos')).json(), [])
        for (const acao of ['aceitar', 'recusar']) {
            assert.equal((await requisitar('PATCH', `/vinculos/${pendente.id}/${acao}`, outroAluno)).statusCode, 403)
            assert.equal((await requisitar('PATCH', `/vinculos/invalido/${acao}`, aluno)).statusCode, 400)
            assert.equal((await requisitar('PATCH', `/vinculos/${randomUUID()}/${acao}`, aluno)).statusCode, 404)
        }
        assert.equal((await requisitar('PATCH', `/vinculos/${pendente.id}/recusar`, aluno)).json().status, 'RECUSADO')
        assert.equal((await requisitar('PATCH', `/vinculos/${pendente.id}/aceitar`, aluno)).statusCode, 409)
        const segunda = (await criarSolicitacao()).json()
        assert.equal((await requisitar('PATCH', `/vinculos/${segunda.id}/aceitar`, aluno)).json().status, 'ATIVO')
        assert.equal((await requisitar('PATCH', `/vinculos/${segunda.id}/recusar`, aluno)).statusCode, 409)
        assert.equal((await criarSolicitacao()).statusCode, 409)
        const alunos = (await requisitar('GET', '/vinculos/alunos')).json()
        assert.deepEqual(alunos.map((u) => u.id), [aluno])
        assert.equal(alunos[0].passwordHash, undefined)
        assert.deepEqual((await requisitar('GET', '/vinculos/alunos', outroProfissional)).json(), [])
        assert.deepEqual((await requisitar('GET', '/vinculos/profissionais', outroAluno)).json(), [])
        assert.equal((await requisitar('GET', '/vinculos/alunos', aluno)).statusCode, 403)
        assert.equal((await requisitar('GET', '/vinculos/profissionais', profissional)).statusCode, 403)
    })

    await t.test('criações e aceites simultâneos têm um único vencedor', async () => {
        const criacoes = await Promise.all(Array.from({ length: 12 }, () => criar()))
        assert.equal(criacoes.filter((r) => r.statusCode === 201).length, 1)
        assert.equal(criacoes.filter((r) => r.statusCode === 409).length, 11)
        const convite = criacoes.find((r) => r.statusCode === 201).json()
        const aceites = await Promise.all(Array.from({ length: 12 }, () =>
            requisitar('POST', recurso(convite.codigo) + '/aceitar', aluno)))
        assert.equal(aceites.filter((r) => r.statusCode === 200).length, 1)
        assert.equal(aceites.filter((r) => r.statusCode === 409).length, 11)
        assert.equal((await ler(c.arquivoVinculos)).length, 1)
    })
})

test('concorrência entre serviços e instâncias, persistência e rollback', async (t) => {
    for (const ordem of ['convite-primeiro', 'solicitacao-primeiro']) {
        await t.test(`aceite de convite versus solicitação direta: ${ordem}`, async (t) => {
            const c = await contexto(t)
            const convite = await c.service.criarConvite(profissional, aluno)
            const outroRepositorio = new JsonVinculoRepository(c.arquivoVinculos)
            const direto = new VinculoService(outroRepositorio, c.users)
            const aceitar = () => c.service.aceitarConvite(convite.codigo, aluno)
            const solicitar = () => direto.criarSolicitacao(profissional, { alunoId: aluno })
            const operacoes = ordem === 'convite-primeiro' ? [aceitar, solicitar] : [solicitar, aceitar]
            const resultados = await Promise.allSettled(operacoes.map((operacao) => operacao()))
            assert.equal(resultados.filter((r) => r.status === 'fulfilled').length, 1)
            assert.ok(resultados.find((r) => r.status === 'rejected').reason instanceof VinculoJaExistenteError)
            assert.equal((await ler(c.arquivoVinculos)).length, 1)
        })
    }

    await t.test('expiraEm igual a agora já expirou; GET não escreve', async (t) => {
        const c = await contexto(t)
        const convite = await c.service.criarConvite(profissional, aluno)
        const agora = Date.now()
        t.mock.method(Date, 'now', () => agora)
        await c.convites.atualizar({ ...convite, expiraEm: new Date(agora) })
        const antes = await readFile(c.arquivoConvites, 'utf8')
        await assert.rejects(c.service.buscarConvite(convite.codigo, aluno), { statusCode: 410 })
        assert.equal(await readFile(c.arquivoConvites, 'utf8'), antes)
        assert.equal((await c.service.criarConvite(profissional, aluno)).status, 'PENDENTE')
    })

    await t.test('falha no repositório não bloqueia a fila compartilhada', async (t) => {
        const c = await contexto(t)
        const outro = new JsonConviteRepository(c.arquivoConvites)
        await writeFile(c.arquivoConvites, '{')
        await assert.rejects(c.convites.criar({ codigo: 'ABCDEFGH', profissionalId: profissional, alunoId: aluno }))
        assert.equal(await readFile(c.arquivoConvites, 'utf8'), '{')
        await gravar(c.arquivoConvites, [])
        assert.equal((await outro.criar({ codigo: 'ABCDEFGH', profissionalId: profissional, alunoId: aluno })).status, 'PENDENTE')
        await writeFile(c.arquivoVinculos, '{')
        await assert.rejects(c.vinculos.criar({ profissionalId: profissional, alunoId: aluno, status: 'ATIVO' }))
        assert.equal(await readFile(c.arquivoVinculos, 'utf8'), '{')
        await gravar(c.arquivoVinculos, [])
        const novo = new JsonVinculoRepository(c.arquivoVinculos)
        assert.equal((await novo.criar({ profissionalId: profissional, alunoId: aluno, status: 'ATIVO' })).status, 'ATIVO')
    })

    await t.test('duas instâncias de ConviteService não criam pendentes duplicados', async (t) => {
        const c = await contexto(t)
        const outro = new ConviteService(new JsonConviteRepository(c.arquivoConvites), new JsonVinculoRepository(c.arquivoVinculos), c.users)
        const resultados = await Promise.allSettled([c.service.criarConvite(profissional, aluno), outro.criarConvite(profissional, aluno)])
        assert.equal(resultados.filter((r) => r.status === 'fulfilled').length, 1)
        assert.ok(resultados.find((r) => r.status === 'rejected').reason instanceof ConvitePendenteJaExistenteError)
        assert.equal((await ler(c.arquivoConvites)).length, 1)
        assert.equal((await outro.criarConvite(profissional, outroAluno)).alunoId, outroAluno)
    })

    await t.test('aceite versus recusa de convite e de vínculo preserva um único estado final', async (t) => {
        const c = await contexto(t)
        const convite = await c.service.criarConvite(profissional, aluno)
        const resultados = await Promise.allSettled([
            c.service.recusarConvite(convite.codigo, aluno), c.service.aceitarConvite(convite.codigo, aluno)
        ])
        assert.equal(resultados.filter((r) => r.status === 'fulfilled').length, 1)
        assert.equal((await ler(c.arquivoConvites))[0].status, 'RECUSADO')
        assert.deepEqual(await ler(c.arquivoVinculos), [])
        const solicitacao = await c.vinculoService.criarSolicitacao(profissional, { alunoId: aluno })
        const outro = new VinculoService(new JsonVinculoRepository(c.arquivoVinculos), c.users)
        const respostas = await Promise.allSettled([
            c.vinculoService.aceitarSolicitacao(solicitacao.id, aluno), outro.recusarSolicitacao(solicitacao.id, aluno)
        ])
        assert.equal(respostas.filter((r) => r.status === 'fulfilled').length, 1)
        assert.equal((await ler(c.arquivoVinculos))[0].status, 'ATIVO')
    })

    await t.test('repositórios distintos no mesmo arquivo não perdem gravações', async (t) => {
        const c = await contexto(t)
        const convites = [c.convites, new JsonConviteRepository(path.join(c.data, '..', 'data', 'convites.json'))]
        const vinculos = [c.vinculos, new JsonVinculoRepository(c.arquivoVinculos)]
        await Promise.all(Array.from({ length: 30 }, (_, i) => convites[i % 2].criar({
            codigo: String(i), profissionalId: profissional, alunoId: randomUUID()
        })))
        await Promise.all(Array.from({ length: 30 }, (_, i) => vinculos[i % 2].criar({
            profissionalId: profissional, alunoId: randomUUID(), status: 'PENDENTE'
        })))
        assert.equal((await ler(c.arquivoConvites)).length, 30)
        assert.equal((await ler(c.arquivoVinculos)).length, 30)
        assert.equal((await readdir(c.data)).filter((n) => n.endsWith('.tmp')).length, 0)
        const reaberto = await new JsonConviteRepository(c.arquivoConvites).buscarPorCodigo('0')
        assert.ok(reaberto.criadoEm instanceof Date)
        assert.ok(reaberto.expiraEm instanceof Date)
        assert.equal(reaberto.status, 'PENDENTE')
        const registro = (await ler(c.arquivoVinculos))[0]
        assert.ok((await new JsonVinculoRepository(c.arquivoVinculos).buscarPorId(registro.id)).criadoEm instanceof Date)
    })

    for (const falha of ['throw', 'null']) {
        await t.test(`rollback se atualização do convite retornar ${falha}; fila se recupera`, async (t) => {
            const c = await contexto(t)
            const preexistente = await c.vinculos.criar({ profissionalId: outroProfissional, alunoId: outroAluno, status: 'ATIVO' })
            const convite = await c.service.criarConvite(profissional, aluno)
            const atualizar = c.convites.atualizar.bind(c.convites)
            c.convites.atualizar = async () => {
                if (falha === 'null') return null
                throw new Error('falha de escrita simulada')
            }
            await assert.rejects(c.service.aceitarConvite(convite.codigo, aluno))
            const registros = await ler(c.arquivoVinculos)
            assert.deepEqual(registros.map((v) => v.id), [preexistente.id])
            assert.equal((await ler(c.arquivoConvites))[0].status, 'PENDENTE')
            c.convites.atualizar = atualizar
            assert.equal((await c.service.aceitarConvite(convite.codigo, aluno)).status, 'ACEITO')
            assert.equal((await ler(c.arquivoVinculos)).length, 2)
        })
    }

    for (const falha of ['throw', 'false']) {
        await t.test(`falha de rollback (${falha}) sinaliza verificação manual`, async (t) => {
            const c = await contexto(t)
            const convite = await c.service.criarConvite(profissional, aluno)
            c.convites.atualizar = async () => { throw new Error('falha ao salvar convite') }
            c.vinculos.remover = async () => {
                if (falha === 'false') return false
                throw new Error('falha ao remover vínculo')
            }
            await assert.rejects(c.service.aceitarConvite(convite.codigo, aluno), (erro) => {
                assert.ok(erro instanceof FalhaRollbackConviteError)
                assert.match(erro.message, /verificação manual/)
                assert.ok(erro.cause instanceof AggregateError)
                return true
            })
            assert.equal((await ler(c.arquivoConvites))[0].status, 'PENDENTE')
            assert.equal((await ler(c.arquivoVinculos)).length, 1)
            await assert.rejects(c.service.criarConvite(profissional, aluno), VinculoJaExistenteError)
        })
    }

    await t.test('consulta/listagem aguarda rollback e não expõe vínculo provisório', async (t) => {
        const c = await contexto(t)
        const convite = await c.service.criarConvite(profissional, aluno)
        let sinalizar, liberar
        const chegou = new Promise((resolve) => { sinalizar = resolve })
        const continuar = new Promise((resolve) => { liberar = resolve })
        c.convites.atualizar = async () => {
            sinalizar()
            await continuar
            throw new Error('falha de atualização')
        }
        const aceite = assert.rejects(c.service.aceitarConvite(convite.codigo, aluno))
        await chegou
        let terminou = false
        const consulta = c.vinculoService.listarAlunosVinculados(profissional).then((resposta) => {
            terminou = true
            return resposta
        })
        await new Promise((resolve) => setImmediate(resolve))
        assert.equal(terminou, false)
        liberar()
        await aceite
        assert.deepEqual(await consulta, [])
        assert.equal((await c.service.buscarConvite(convite.codigo, aluno)).convite.status, 'PENDENTE')
    })
})
