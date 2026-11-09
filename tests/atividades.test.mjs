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
import { JsonAtividadeRepository } from '../dist/modules/atividades/repositories/json-atividade.repository.js'

const raiz = fileURLToPath(new URL('../', import.meta.url))
const segredo = 'segredo-exclusivo-dos-testes-de-atividades'

// Executa o entrypoint compilado de produção com cwd isolado: inclusive os
// middlewares que escrevem JSON só conseguem acessar os dados temporários.
async function iniciarServidor(cwd) {
    const processo = spawn(process.execPath, [path.join(raiz, 'dist/server.js')], {
        cwd,
        env: { ...process.env, JWT_SECRET: segredo },
        stdio: ['ignore', 'pipe', 'pipe']
    })
    try {
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Servidor não iniciou em 10s')), 10_000)
            let saida = ''
            const concluir = (erro) => {
                clearTimeout(timeout)
                erro ? reject(erro) : resolve()
            }
            processo.on('error', concluir)
            processo.once('exit', (code) => concluir(new Error(`Servidor encerrou (${code}): ${saida}`)))
            processo.stdout.on('data', (chunk) => {
                saida += chunk.toString()
                if (saida.includes('Erro ao iniciar servidor:')) concluir(new Error(saida))
                if (saida.includes('Servidor iniciado na porta 3030')) concluir()
            })
            processo.stderr.on('data', (chunk) => { saida += chunk.toString() })
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

function token(userId, opcoes = {}) {
    return jwt.sign({ userId }, segredo, { jwtid: randomUUID(), expiresIn: '1h', ...opcoes })
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
            ? JSON.parse(texto) : texto
    }
}

test('biblioteca de atividades — HTTP real e JSONs isolados', { timeout: 60_000 }, async (t) => {
    const arquivos = (await fs.readdir(path.join(raiz, 'data'))).filter((nome) => nome.endsWith('.json'))
    const originais = new Map(await Promise.all(arquivos.map(async (nome) =>
        [nome, await fs.readFile(path.join(raiz, 'data', nome))]
    )))
    const temporario = await fs.mkdtemp(path.join(tmpdir(), 'deshi-atividades-'))
    let processo

    try {
        await fs.mkdir(path.join(temporario, 'data'))
        for (const nome of ['atividades.json', 'modalidades.json']) {
            await fs.writeFile(path.join(temporario, 'data', nome), originais.get(nome))
        }
        await fs.writeFile(path.join(temporario, 'data/atividades-personalizadas.json'), '[]')
        const profissionalA = randomUUID()
        const profissionalB = randomUUID()
        const estudante = randomUUID()
        await fs.writeFile(path.join(temporario, 'data/users.json'), JSON.stringify([
            { id: profissionalA, profile: 'PROFESSIONAL' },
            { id: profissionalB, profile: 'PROFESSIONAL' },
            { id: estudante, profile: 'STUDENT' }
        ]))
        await fs.writeFile(path.join(temporario, 'data/revoked-tokens.json'), '[]')
        await fs.writeFile(path.join(temporario, 'data/profissional-modalidades.json'), '[]')

        const a = token(profissionalA)
        const b = token(profissionalB)
        const padroes = JSON.parse(originais.get('atividades.json'))
        const modalidades = JSON.parse(originais.get('modalidades.json'))
        const musculacao = modalidades.find((item) => item.nome === 'Musculação').id
        const yoga = modalidades.find((item) => item.nome === 'Yoga').id
        const dados = { nome: 'Agachamento personalizado A', modalidadeId: musculacao }
        const caminhoCatalogo = path.join(temporario, 'data/atividades.json')
        const caminhoPersonalizadas = path.join(temporario, 'data/atividades-personalizadas.json')
        const lerAtividades = async () => {
            const [catalogo, personalizadas] = await Promise.all([
                fs.readFile(caminhoCatalogo, 'utf-8'),
                fs.readFile(caminhoPersonalizadas, 'utf-8')
            ])
            return JSON.stringify([...JSON.parse(catalogo), ...JSON.parse(personalizadas)])
        }
        processo = await iniciarServidor(temporario)

        await t.test('catálogo permanente: UUIDs únicos, origens e modalidades válidas', () => {
            assert.equal(padroes.length, 14)
            assert.ok(padroes.length >= modalidades.length)
            assert.equal(new Set(padroes.map((item) => item.id)).size, padroes.length)
            for (const item of padroes) {
                assert.equal(item.origem, 'PADRAO')
                assert.match(item.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
                assert.equal(item.profissionalId, null)
                assert.ok(item.nome.trim())
                assert.ok(modalidades.some((modalidade) => modalidade.id === item.modalidadeId))
            }
            assert.ok(modalidades.every((modalidade) => padroes.some((item) => item.modalidadeId === modalidade.id)))
        })

        await t.test('biblioteca sem filtros e padrões iguais para A e B', async () => {
            for (const credencial of [a, b]) {
                const resposta = await requisitar('GET', '/atividades', credencial)
                assert.equal(resposta.status, 200)
                assert.deepEqual(resposta.body, padroes)
            }
        })

        await t.test('busca parcial e case-insensitive', async () => {
            const resposta = await requisitar('GET', '/atividades?busca=AGACH', a)
            assert.equal(resposta.status, 200)
            assert.deepEqual(resposta.body, padroes.filter((item) => item.nome.toLowerCase().includes('agach')))
            assert.ok(resposta.body.length > 0)
        })

        await t.test('filtro por modalidade', async () => {
            const resposta = await requisitar('GET', `/atividades?modalidadeId=${yoga}`, a)
            assert.equal(resposta.status, 200)
            assert.deepEqual(resposta.body, padroes.filter((item) => item.modalidadeId === yoga))
        })

        await t.test('busca e modalidade combinadas por AND', async () => {
            const positivo = await requisitar('GET', `/atividades?busca=agach&modalidadeId=${musculacao}`, a)
            assert.equal(positivo.status, 200)
            assert.ok(positivo.body.length > 0)
            assert.ok(positivo.body.every((item) => item.modalidadeId === musculacao && item.nome.toLowerCase().includes('agach')))
            const negativo = await requisitar('GET', `/atividades?busca=agach&modalidadeId=${yoga}`, a)
            assert.equal(negativo.status, 200)
            assert.deepEqual(negativo.body, [])
        })

        await t.test('busca vazia/espaços lista tudo; sem correspondência retorna []', async () => {
            for (const busca of ['', '%20%20']) {
                const resposta = await requisitar('GET', `/atividades?busca=${busca}`, a)
                assert.equal(resposta.status, 200)
                assert.deepEqual(resposta.body, padroes)
            }
            const resposta = await requisitar('GET', '/atividades?busca=zzzinexistente', a)
            assert.equal(resposta.status, 200)
            assert.deepEqual(resposta.body, [])
        })

        let personalizadaA
        let personalizadaB
        await t.test('criação personalizada sem descrição e sem mídia', async () => {
            const resposta = await requisitar('POST', '/atividades', a, dados)
            assert.equal(resposta.status, 201)
            personalizadaA = resposta.body
            assert.equal(personalizadaA.origem, 'PERSONALIZADA')
            assert.equal(personalizadaA.profissionalId, profissionalA)
            assert.equal(personalizadaA.nome, dados.nome)
            assert.equal(personalizadaA.modalidadeId, musculacao)
            assert.ok(!('descricao' in personalizadaA))
            assert.ok(!('midiaUrl' in personalizadaA))
            assert.match(personalizadaA.id, /^[0-9a-f-]{36}$/)
            assert.deepEqual(JSON.parse(await fs.readFile(caminhoPersonalizadas, 'utf-8')), [personalizadaA])
            assert.deepEqual(await fs.readFile(caminhoCatalogo), originais.get('atividades.json'))
        })

        await t.test('descrição opcional com mídia HTTP/HTTPS válida e normalização do nome', async () => {
            for (const protocolo of ['http', 'https']) {
                const resposta = await requisitar('POST', '/atividades', b, {
                    nome: '  Movimento B  ', modalidadeId: yoga, midiaUrl: `${protocolo}://example.com/video.mp4`
                })
                assert.equal(resposta.status, 201)
                assert.equal(resposta.body.nome, 'Movimento B')
                assert.equal(resposta.body.midiaUrl, `${protocolo}://example.com/video.mp4`)
                assert.ok(!('descricao' in resposta.body))
                personalizadaB = resposta.body
            }
        })

        await t.test('mídia opcional com descrição preenchida', async () => {
            const resposta = await requisitar('POST', '/atividades', b, { nome: 'Descrição B', modalidadeId: yoga, descricao: '  Descrição da atividade  ' })
            assert.equal(resposta.status, 201)
            assert.equal(resposta.body.descricao, 'Descrição da atividade')
            assert.ok(!('midiaUrl' in resposta.body))
        })

        await t.test('isolamento em ambos os sentidos, padrões visíveis e busca sem vazamento', async () => {
            for (const [credencial, id, minha, alheia] of [
                [a, profissionalA, personalizadaA, personalizadaB],
                [b, profissionalB, personalizadaB, personalizadaA]
            ]) {
                const resposta = await requisitar('GET', '/atividades', credencial)
                assert.equal(resposta.status, 200)
                assert.ok(resposta.body.some((item) => item.id === minha.id))
                assert.ok(!resposta.body.some((item) => item.id === alheia.id))
                assert.ok(resposta.body.every((item) => item.origem === 'PADRAO' || item.profissionalId === id))
                assert.deepEqual(resposta.body.filter((item) => item.origem === 'PADRAO'), padroes)
                const filtrada = await requisitar('GET', `/atividades?busca=${encodeURIComponent(alheia.nome)}&modalidadeId=${alheia.modalidadeId}`, credencial)
                assert.equal(filtrada.status, 200)
                assert.deepEqual(filtrada.body, [])
                const propria = await requisitar('GET', `/atividades?busca=${encodeURIComponent(minha.nome)}&modalidadeId=${minha.modalidadeId}`, credencial)
                assert.equal(propria.status, 200)
                assert.ok(propria.body.some((item) => item.id === minha.id))
            }
        })

        const invalidos = [
            ['URL inválida', { ...dados, midiaUrl: 'nao-e-url' }],
            ['URL relativa', { ...dados, midiaUrl: '/video.mp4' }],
            ['URL com protocolo não permitido', { ...dados, midiaUrl: 'javascript:alert(1)' }],
            ['modalidade inexistente', { ...dados, modalidadeId: randomUUID() }],
            ['UUID inválido', { ...dados, modalidadeId: 'abc' }],
            ['modalidade obrigatória', { nome: 'Atividade' }],
            ['nome vazio', { ...dados, nome: '' }],
            ['nome só com espaços', { ...dados, nome: '   ' }],
            ['nome obrigatório', { modalidadeId: musculacao }],
            ['outro profissional no body', { ...dados, profissionalId: profissionalB }],
            ['origem PADRAO no body', { ...dados, origem: 'PADRAO' }],
            ['id fornecido pelo cliente', { ...dados, id: randomUUID() }],
            ['descrição de tipo inválido', { ...dados, descricao: 12 }],
            ['mídia de tipo inválido', { ...dados, midiaUrl: 12 }]
        ]
        for (const [nome, body] of invalidos) {
            await t.test(`${nome} → 400 sem gravar`, async () => {
                const antes = await lerAtividades()
                assert.equal((await requisitar('POST', '/atividades', a, body)).status, 400)
                assert.equal(await lerAtividades(), antes)
            })
        }

        await t.test('US09: métricas de prescrição são rejeitadas sem persistir ou alterar a biblioteca', async () => {
            const antes = await lerAtividades()
            const bibliotecaAntes = await requisitar('GET', '/atividades', a)
            assert.equal(bibliotecaAntes.status, 200)
            const metricas = {
                series: 3,
                repeticoes: 12,
                carga: 20,
                descanso: 60,
                duracao: 30,
                duracaoPrescrita: 30,
                rounds: 5,
                distancia: 1000,
                quantidade: 10,
                velocidade: 8,
                prescricao: { series: 3, repeticoes: 12 }
            }
            for (const [campo, valor] of Object.entries(metricas)) {
                const criacao = await requisitar('POST', '/atividades', a, { ...dados, [campo]: valor })
                assert.equal(criacao.status, 400, `POST deve rejeitar ${campo}`)
                const query = new URLSearchParams({ [campo]: String(valor) })
                const consulta = await requisitar('GET', `/atividades?${query}`, a)
                assert.equal(consulta.status, 400, `GET deve rejeitar ${campo}`)
                assert.equal(await lerAtividades(), antes, `${campo} não deve alterar o JSON`)
            }
            const bibliotecaDepois = await requisitar('GET', '/atividades', a)
            assert.equal(bibliotecaDepois.status, 200)
            assert.deepEqual(bibliotecaDepois.body, bibliotecaAntes.body)
            const camposDaBiblioteca = new Set(['id', 'nome', 'descricao', 'midiaUrl', 'modalidadeId', 'origem', 'profissionalId'])
            for (const atividade of JSON.parse(antes)) {
                assert.ok(Object.keys(atividade).every((campo) => camposDaBiblioteca.has(campo)),
                    'O catálogo e as personalizadas devem conter somente campos da biblioteca')
            }
        })

        for (const [nome, query] of [
            ['UUID inválido', 'modalidadeId=abc'],
            ['modalidade inexistente', `modalidadeId=${randomUUID()}`],
            ['outro profissional', `profissionalId=${profissionalB}`],
            ['busca repetida', 'busca=a&busca=b']
        ]) {
            await t.test(`filtro com ${nome} → 400`, async () => {
                assert.equal((await requisitar('GET', `/atividades?${query}`, a)).status, 400)
            })
        }

        const revogado = token(profissionalA)
        assert.equal((await requisitar('POST', '/logout', revogado)).status, 204)
        for (const [nome, credencial, status] of [
            ['STUDENT', token(estudante), 403],
            ['sem token', undefined, 401],
            ['token inválido', 'invalido', 401],
            ['token expirado', token(profissionalA, { expiresIn: -1 }), 401],
            ['token revogado', revogado, 401],
            ['usuário inexistente', token(randomUUID()), 401]
        ]) {
            await t.test(`${nome} → ${status} em GET e POST`, async () => {
                const antes = await lerAtividades()
                assert.equal((await requisitar('GET', '/atividades', credencial)).status, status)
                assert.equal((await requisitar('POST', '/atividades', credencial, dados)).status, status)
                assert.equal(await lerAtividades(), antes)
            })
        }

        await t.test('integração com catálogo sem exigir seleção pessoal de modalidades', async () => {
            const catalogo = await requisitar('GET', '/modalidades', a)
            assert.equal(catalogo.status, 200)
            assert.deepEqual(catalogo.body, modalidades)
            const selecao = await requisitar('GET', '/modalidades/minhas', a)
            assert.equal(selecao.status, 200)
            assert.deepEqual(selecao.body, [])
            assert.equal(await fs.readFile(path.join(temporario, 'data/modalidades.json'), 'utf-8'), originais.get('modalidades.json').toString())
            assert.equal(await fs.readFile(path.join(temporario, 'data/profissional-modalidades.json'), 'utf-8'), '[]')
        })

        await t.test('persistência, isolamento e revogação após reinício do processo', async () => {
            const antes = await requisitar('GET', '/atividades', a)
            const persistidas = await fs.readFile(caminhoPersonalizadas)
            assert.ok(JSON.parse(persistidas).some((item) => item.id === personalizadaA.id))
            await pararServidor(processo)
            processo = await iniciarServidor(temporario)
            const depois = await requisitar('GET', '/atividades', a)
            assert.equal(depois.status, 200)
            assert.deepEqual(depois.body, antes.body)
            assert.ok(depois.body.some((item) => item.id === personalizadaA.id))
            assert.deepEqual(depois.body.filter((item) => item.origem === 'PADRAO'), padroes)
            const outro = await requisitar('GET', '/atividades', b)
            assert.equal(outro.status, 200)
            assert.ok(!outro.body.some((item) => item.id === personalizadaA.id))
            assert.deepEqual(outro.body.filter((item) => item.origem === 'PADRAO'), padroes)
            assert.deepEqual(await fs.readFile(caminhoPersonalizadas), persistidas)
            assert.ok(JSON.parse(persistidas).every((item) => item.origem === 'PERSONALIZADA'))
            assert.deepEqual(await fs.readFile(caminhoCatalogo), originais.get('atividades.json'))
            await assert.rejects(fs.access(`${caminhoPersonalizadas}.tmp`), { code: 'ENOENT' })
            assert.equal((await requisitar('GET', '/atividades', revogado)).status, 401)
        })

        await t.test('gravações concorrentes no repositório preservam todas as inclusões e padrões', async () => {
            const arquivo = path.join(temporario, 'concorrencia.json')
            await fs.writeFile(arquivo, '[]')
            const repository = new JsonAtividadeRepository(caminhoCatalogo, arquivo)
            const novas = Array.from({ length: 20 }, (_, indice) => ({ ...personalizadaA, id: randomUUID(), nome: `Concorrente ${indice}` }))
            await Promise.all(novas.map((item) => repository.criar(item)))
            const gravadas = await repository.listar()
            assert.equal(gravadas.length, padroes.length + novas.length)
            for (const item of [...padroes, ...novas]) assert.ok(gravadas.some((gravada) => gravada.id === item.id))
            assert.deepEqual(gravadas.filter((item) => item.origem === 'PADRAO'), padroes)
            assert.deepEqual(JSON.parse(await fs.readFile(arquivo, 'utf-8')), novas)
            assert.deepEqual(await fs.readFile(caminhoCatalogo), originais.get('atividades.json'))
            await assert.rejects(fs.access(`${arquivo}.tmp`), { code: 'ENOENT' })
        })
    } finally {
        await pararServidor(processo)
        await fs.rm(temporario, { recursive: true, force: true })
        await assert.rejects(fs.access(temporario), { code: 'ENOENT' })
        for (const [nome, conteudo] of originais) {
            assert.deepEqual(await fs.readFile(path.join(raiz, 'data', nome)), conteudo, `JSON permanente alterado: ${nome}`)
        }
    }
})
