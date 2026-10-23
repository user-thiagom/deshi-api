import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { test } from 'node:test'
import jwt from 'jsonwebtoken'

const raiz = fileURLToPath(new URL('../', import.meta.url))
const segredo = 'segredo-exclusivo-dos-testes-de-programas'

async function iniciarServidor(cwd) {
    const processo = spawn(process.execPath, [path.join(raiz, 'dist/server.js')], {
        cwd,
        env: { ...process.env, JWT_SECRET: segredo },
        stdio: ['ignore', 'pipe', 'pipe']
    })

    try {
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(
                () => reject(new Error('Servidor não iniciou em 10s')),
                10_000
            )
            let saida = ''

            const concluir = (erro) => {
                clearTimeout(timeout)
                erro ? reject(erro) : resolve()
            }

            processo.on('error', concluir)
            processo.once('exit', (code) =>
                concluir(new Error(`Servidor encerrou (${code}): ${saida}`))
            )
            processo.stdout.on('data', (chunk) => {
                saida += chunk.toString()
                if (saida.includes('Erro ao iniciar servidor:')) concluir(new Error(saida))
                if (saida.includes('Servidor iniciado na porta 3030')) concluir()
            })
            processo.stderr.on('data', (chunk) => {
                saida += chunk.toString()
            })
        })

        return processo
    } catch (erro) {
        await pararServidor(processo)
        throw erro
    }
}

async function pararServidor(processo) {
    if (!processo || processo.exitCode !== null || processo.signalCode !== null) return
    const terminou = once(processo, 'exit')
    processo.kill('SIGTERM')
    await terminou
}

function token(userId) {
    return jwt.sign({ userId }, segredo, {
        jwtid: randomUUID(),
        expiresIn: '1h'
    })
}

async function requisitar(method, url, credencial, body) {
    const resposta = await fetch(`http://localhost:3030${url}`, {
        method,
        headers: {
            ...(credencial ? { Authorization: `Bearer ${credencial}` } : {}),
            ...(body !== undefined ? { 'Content-Type': 'application/json' } : {})
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(5000)
    })

    const texto = await resposta.text()

    return {
        status: resposta.status,
        body: resposta.headers.get('content-type')?.includes('application/json') && texto
            ? JSON.parse(texto)
            : texto
    }
}

test('HU10 — criação de programas, HTTP real e JSONs isolados', { timeout: 60_000 }, async (t) => {
    const temporario = await fs.mkdtemp(path.join(tmpdir(), 'deshi-programas-'))
    let processo

    try {
        const data = path.join(temporario, 'data')
        await fs.mkdir(data)

        const copiar = async (origem, destino = origem) =>
            fs.copyFile(path.join(raiz, 'data', origem), path.join(data, destino))

        for (const arquivo of [
            'atividades.json',
            'modalidades.json',
            'campos-configuracao-atividades.json'
        ]) {
            await copiar(arquivo)
        }

        for (const arquivo of [
            'atividades-personalizadas.json',
            'campos-configuracao-personalizadas.json',
            'profissional-modalidades.json',
            'vinculos.json',
            'revoked-tokens.json',
            'programas.json'
        ]) {
            await fs.writeFile(path.join(data, arquivo), '[]\n')
        }

        
const profissionalId = randomUUID()
const outroProfissionalId = randomUUID()
const alunoId = randomUUID()
const outroAlunoId = randomUUID()
const musculacaoId = 'd1b10e90-8d5c-4ad3-9d68-000000000001'
const atividadeId = 'a7101d90-8d5c-4ad3-9d68-000000000001'

        
await fs.writeFile(path.join(data, 'users.json'), JSON.stringify([
    { id: profissionalId, profile: 'PROFESSIONAL' },
    { id: outroProfissionalId, profile: 'PROFESSIONAL' },
    { id: alunoId, profile: 'STUDENT' },
    { id: outroAlunoId, profile: 'STUDENT' }
]))


        await fs.writeFile(path.join(data, 'vinculos.json'), JSON.stringify([{
            id: randomUUID(),
            profissionalId,
            alunoId,
            status: 'ATIVO',
            criadoEm: new Date().toISOString(),
            atualizadoEm: new Date().toISOString()
        }]))

        await fs.writeFile(path.join(data, 'profissional-modalidades.json'), JSON.stringify([{
            profissionalId,
            modalidadeIds: [musculacaoId]
        }]))

        processo = await iniciarServidor(temporario)

        const credencial = token(profissionalId)
        const body = {
            alunoId,
            modalidadeId: musculacaoId,
            nome: 'Programa inicial',
            atividades: [{
                atividadeId,
                ordem: 1,
                valores: {
                    series: 3,
                    repeticoes: 12,
                    cargaKg: 20,
                    descansoSegundos: 60
                }
            }]
        }

        await t.test('cria programa válido e persiste os dados', async () => {
            const resposta = await requisitar('POST', '/programas', credencial, body)

            assert.equal(resposta.status, 201)
            assert.equal(resposta.body.profissionalId, profissionalId)
            assert.equal(resposta.body.alunoId, alunoId)
            assert.equal(resposta.body.modalidadeId, musculacaoId)
            assert.equal(resposta.body.nome, body.nome)
            assert.equal(resposta.body.atividades.length, 1)
            assert.deepEqual(resposta.body.atividades[0], body.atividades[0])

            const persistidos = JSON.parse(
                await fs.readFile(path.join(data, 'programas.json'), 'utf-8')
            )
            assert.equal(persistidos.length, 1)
            assert.equal(persistidos[0].id, resposta.body.id)
        })

        await t.test('ordena atividades antes de retornar e persistir', async () => {
            const bodyOrdenacao = {
                ...body,
                nome: 'Programa com ordem definida',
                atividades: [
                    {
                        atividadeId: 'a7101d90-8d5c-4ad3-9d68-000000000002',
                        ordem: 2,
                        valores: { series: 3, repeticoes: 10 }
                    },
                    {
                        atividadeId: 'a7101d90-8d5c-4ad3-9d68-000000000001',
                        ordem: 1,
                        valores: { series: 3, repeticoes: 12 }
                    }
                ]
            }

            const resposta = await requisitar(
                'POST',
                '/programas',
                credencial,
                bodyOrdenacao
            )

            assert.equal(resposta.status, 201)
            assert.deepEqual(
                resposta.body.atividades.map((atividade) => atividade.ordem),
                [1, 2]
            )
            assert.deepEqual(
                resposta.body.atividades.map((atividade) => atividade.atividadeId),
                [
                    'a7101d90-8d5c-4ad3-9d68-000000000001',
                    'a7101d90-8d5c-4ad3-9d68-000000000002'
                ]
            )

            const persistidos = JSON.parse(
                await fs.readFile(path.join(data, 'programas.json'), 'utf-8')
            )
            const salvo = persistidos.find(
                (programa) => programa.id === resposta.body.id
            )

            assert.ok(salvo)
            assert.deepEqual(
                salvo.atividades.map((atividade) => atividade.ordem),
                [1, 2]
            )
        })

        await t.test('sem token retorna 401', async () => {
            const resposta = await requisitar('POST', '/programas', undefined, body)
            assert.equal(resposta.status, 401)
        })

        await t.test('aluno não pode criar programa', async () => {
            const resposta = await requisitar('POST', '/programas', token(alunoId), body)
            assert.equal(resposta.status, 403)
        })
        await t.test('rejeita aluno sem vínculo ativo', async () => {
            const programaSemVinculo = {
                ...body,
                alunoId: outroAlunoId
            }

            const resposta = await requisitar(
                'POST',
                '/programas',
                credencial,
                programaSemVinculo
            )

            assert.equal(resposta.status, 403)

            const persistidos = JSON.parse(
                await fs.readFile(path.join(data, 'programas.json'), 'utf-8')
            )
            assert.equal(persistidos.length, 2)
        })

        await t.test('aluno consulta somente os próprios programas', async () => {
            const respostaAluno = await requisitar(
                'GET',
                '/programas',
                token(alunoId)
            )

            assert.equal(respostaAluno.status, 200)
            assert.equal(respostaAluno.body.length, 2)
            assert.equal(respostaAluno.body[0].alunoId, alunoId)

            const respostaOutroAluno = await requisitar(
                'GET',
                '/programas',
                token(outroAlunoId)
            )

            assert.equal(respostaOutroAluno.status, 200)
            assert.deepEqual(respostaOutroAluno.body, [])
        })

        await t.test('profissional consulta somente os próprios programas', async () => {
            const resposta = await requisitar(
                'GET',
                '/programas',
                token(profissionalId)
            )

            assert.equal(resposta.status, 200)
            assert.equal(resposta.body.length, 2)
            assert.equal(resposta.body[0].profissionalId, profissionalId)

            const respostaOutroProfissional = await requisitar(
                'GET',
                '/programas',
                token(outroProfissionalId)
            )

            assert.equal(respostaOutroProfissional.status, 200)
            assert.deepEqual(respostaOutroProfissional.body, [])
        })

        await t.test('consulta de programas sem token retorna 401', async () => {
            const resposta = await requisitar('GET', '/programas')

            assert.equal(resposta.status, 401)
        })
    } finally {
        await pararServidor(processo)
        await fs.rm(temporario, { recursive: true, force: true })
    }
})

