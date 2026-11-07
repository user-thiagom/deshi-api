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
import { JsonConfiguracaoRepository } from '../dist/modules/configuracoes-atividades/repositories/json-configuracao.repository.js'
import { JsonCamposRepository } from '../dist/modules/configuracoes-atividades/repositories/json-campos.repository.js'
import { definirCamposSchema } from '../dist/modules/configuracoes-atividades/configuracoes-atividades.schema.js'

const raiz = fileURLToPath(new URL('../', import.meta.url))
const segredo = 'segredo-exclusivo-dos-testes-us09'

async function iniciarServidor(cwd) {
    const processo = spawn(process.execPath, [path.join(raiz, 'dist/server.js')], {
        cwd, env: { ...process.env, JWT_SECRET: segredo }, stdio: ['ignore', 'pipe', 'pipe']
    })
    try {
        await new Promise((resolve, reject) => {
            let saida = ''
            const timeout = setTimeout(() => reject(new Error('Servidor não iniciou em 10s')), 10_000)
            const concluir = (erro) => {
                clearTimeout(timeout)
                erro ? reject(erro) : resolve()
            }
            processo.once('error', concluir)
            processo.once('exit', (code) => concluir(new Error(`Servidor encerrou (${code}): ${saida}`)))
            processo.stdout.on('data', (chunk) => {
                saida += chunk.toString()
                if (saida.includes('Erro ao iniciar servidor:')) concluir(new Error(saida))
                if (saida.includes('Servidor iniciado na porta 3030')) concluir()
            })
            processo.stderr.on('data', (chunk) => { saida += chunk.toString() })
        })
        return processo
    } catch (error) {
        await pararServidor(processo)
        throw error
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
        body: texto && resposta.headers.get('content-type')?.includes('application/json') ? JSON.parse(texto) : texto
    }
}

test('US09 — configurações de atividades, HTTP real e JSONs isolados', { timeout: 60_000 }, async (t) => {
    const nomes = (await fs.readdir(path.join(raiz, 'data'))).filter((nome) => nome.endsWith('.json'))
    const originais = new Map(await Promise.all(nomes.map(async (nome) => [nome, await fs.readFile(path.join(raiz, 'data', nome))])))
    const temporario = await fs.mkdtemp(path.join(tmpdir(), 'deshi-us09-'))
    let processo
    const caminho = (nome) => path.join(temporario, 'data', nome)
    const ler = async (nome) => JSON.parse(await fs.readFile(caminho(nome), 'utf-8'))

    try {
        await fs.mkdir(caminho(''))
        const catalogos = ['atividades.json', 'modalidades.json', 'campos-configuracao-atividades.json']
        for (const nome of catalogos) await fs.writeFile(caminho(nome), originais.get(nome))
        for (const nome of [
            'atividades-personalizadas.json', 'profissional-modalidades.json', 'revoked-tokens.json',
            'campos-configuracao-personalizadas.json', 'configuracoes-atividades.json'
        ]) await fs.writeFile(caminho(nome), '[]')
        const profissionalA = randomUUID()
        const profissionalB = randomUUID()
        const estudante = randomUUID()
        await fs.writeFile(caminho('users.json'), JSON.stringify([
            { id: profissionalA, profile: 'PROFESSIONAL' },
            { id: profissionalB, profile: 'PROFESSIONAL' },
            { id: estudante, profile: 'STUDENT' }
        ]))
        const a = token(profissionalA)
        const b = token(profissionalB)
        const atividades = JSON.parse(originais.get('atividades.json'))
        const definicoes = JSON.parse(originais.get('campos-configuracao-atividades.json'))
        const musculacao = atividades[0].id
        const yoga = atividades[2].id
        const boxe = atividades[6].id
        const natacao = atividades[10].id
        const urlCampos = (id) => `/atividades/${id}/campos-configuracao`
        const urlCriar = (id) => `/atividades/${id}/configuracoes`
        const urlConfiguracao = (id) => `/configuracoes-atividades/${id}`
        const campoDuracao = { chave: 'duracaoSegundos', tipo: 'duracao', obrigatorio: true, min: 10, max: 600 }
        const bodyCampos = { campos: [campoDuracao] }
        processo = await iniciarServidor(temporario)

        await t.test('14 definições válidas e únicas, referenciando os IDs estáveis do catálogo', () => {
            assert.equal(definicoes.length, 14)
            assert.equal(new Set(definicoes.map((item) => item.atividadeId)).size, 14)
            for (const definicao of definicoes) {
                assert.ok(atividades.some((item) => item.id === definicao.atividadeId))
                assert.ok(definirCamposSchema.safeParse({ campos: definicao.campos }).success)
            }
        })

        for (const [nome, indice, chaves] of [
            ['Musculação', 0, ['series', 'repeticoes', 'cargaKg', 'descansoSegundos']],
            ['Yoga', 2, ['duracaoSegundos']],
            ['Muay Thai', 4, ['rounds', 'duracaoRoundSegundos', 'descansoSegundos']],
            ['Boxe', 6, ['rounds', 'duracaoRoundSegundos', 'descansoSegundos']],
            ['Tênis', 8, ['quantidade', 'descansoSegundos']],
            ['Natação', 10, ['distanciaMetros', 'quantidade', 'descansoSegundos']],
            ['CrossFit', 12, ['series', 'repeticoes', 'descansoSegundos']]
        ]) {
            await t.test(`campos compatíveis de ${nome}, visíveis para ambos os profissionais`, async () => {
                const id = atividades[indice].id
                for (const credencial of [a, b]) {
                    const resposta = await requisitar('GET', urlCampos(id), credencial)
                    assert.equal(resposta.status, 200)
                    assert.equal(resposta.body.atividadeId, id)
                    assert.deepEqual(resposta.body.campos.map((campo) => campo.chave), chaves)
                    assert.ok(resposta.body.campos.every((campo) => typeof campo.obrigatorio === 'boolean'))
                    assert.deepEqual(resposta.body.campos, definicoes.find((item) => item.atividadeId === id).campos)
                }
            })
        }

        await t.test('cada uma das 14 atividades aceita somente seus obrigatórios, sem exigir os opcionais', async () => {
            for (const definicao of definicoes) {
                const valores = Object.fromEntries(definicao.campos.filter((campo) => campo.obrigatorio).map((campo) => [campo.chave, campo.min]))
                const resposta = await requisitar('POST', urlCriar(definicao.atividadeId), a, { valores })
                assert.equal(resposta.status, 201, definicao.atividadeId)
                assert.deepEqual(resposta.body.valores, valores)
            }
        })

        let configuracao
        await t.test('configuração válida: UUID, referência sem cópia da atividade, valores decimais e datas', async () => {
            const valores = { series: 4, repeticoes: 10, cargaKg: 30.5, descansoSegundos: 0 }
            const resposta = await requisitar('POST', urlCriar(musculacao), a, { valores })
            assert.equal(resposta.status, 201)
            configuracao = resposta.body
            assert.match(configuracao.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
            assert.equal(configuracao.atividadeId, musculacao)
            assert.equal(configuracao.profissionalId, profissionalA)
            assert.deepEqual(configuracao.valores, valores)
            assert.deepEqual(Object.keys(configuracao).sort(), ['id', 'atividadeId', 'profissionalId', 'valores', 'criadoEm', 'atualizadoEm'].sort())
            assert.equal(new Date(configuracao.criadoEm).toISOString(), configuracao.criadoEm)
            assert.equal(configuracao.atualizadoEm, configuracao.criadoEm)
            assert.deepEqual((await ler('configuracoes-atividades.json')).find((item) => item.id === configuracao.id), configuracao)
        })

        await t.test('GET da configuração: criador acessa; outro profissional recebe 404', async () => {
            const resposta = await requisitar('GET', urlConfiguracao(configuracao.id), a)
            assert.equal(resposta.status, 200)
            assert.deepEqual(resposta.body, configuracao)
            assert.equal((await requisitar('GET', urlConfiguracao(configuracao.id), b)).status, 404)
        })

        const invalidas = [
            ['obrigatório ausente', yoga, { valores: {} }],
            ['carga não permitida em Yoga', yoga, { valores: { duracaoSegundos: 60, cargaKg: 10 } }],
            ['duração total não substitui duração do round', boxe, { valores: { rounds: 3, duracaoSegundos: 60 } }],
            ['tipo string', yoga, { valores: { duracaoSegundos: '60' } }],
            ['tipo boolean', yoga, { valores: { duracaoSegundos: true } }],
            ['tipo null', yoga, { valores: { duracaoSegundos: null } }],
            ['tipo objeto', yoga, { valores: { duracaoSegundos: { valor: 60 } } }],
            ['duração fracionária', yoga, { valores: { duracaoSegundos: 1.5 } }],
            ['inteiro fracionário', musculacao, { valores: { series: 1.5, repeticoes: 10 } }],
            ['abaixo do mínimo', yoga, { valores: { duracaoSegundos: 0 } }],
            ['acima do máximo', yoga, { valores: { duracaoSegundos: 86401 } }],
            ['negativo opcional', musculacao, { valores: { series: 3, repeticoes: 10, cargaKg: -1 } }],
            ['distância abaixo do mínimo', natacao, { valores: { distanciaMetros: 0 } }],
            ['distância acima do máximo', natacao, { valores: { distanciaMetros: 100001 } }],
            ['descanso acima do máximo', musculacao, { valores: { series: 3, repeticoes: 10, descansoSegundos: 86401 } }],
            ['profissionalId no body', yoga, { valores: { duracaoSegundos: 60 }, profissionalId: profissionalB }],
            ['profissionalId dentro dos valores', yoga, { valores: { duracaoSegundos: 60, profissionalId: 1 } }],
            ['valores ausentes', yoga, {}],
            ['valores como array', yoga, { valores: [60] }],
            ['chave arbitrária', yoga, { valores: { duracaoSegundos: 60, qualquerCoisa: 2 } }]
        ]
        for (const [nome, id, body] of invalidas) {
            await t.test(`${nome} → 400 sem persistir`, async () => {
                const antes = await fs.readFile(caminho('configuracoes-atividades.json'))
                assert.equal((await requisitar('POST', urlCriar(id), a, body)).status, 400)
                assert.deepEqual(await fs.readFile(caminho('configuracoes-atividades.json')), antes)
            })
        }

        await t.test('limites inclusivos, distância decimal e carga zero são aceitos', async () => {
            for (const [id, valores] of [
                [yoga, { duracaoSegundos: 86400 }],
                [natacao, { distanciaMetros: 25.5, quantidade: 2, descansoSegundos: 0 }],
                [musculacao, { series: 1, repeticoes: 1, cargaKg: 0 }],
                [boxe, { rounds: 3, duracaoRoundSegundos: 120, descansoSegundos: 60 }]
            ]) assert.equal((await requisitar('POST', urlCriar(id), a, { valores })).status, 201)
        })

        let personalizada
        let configuracaoPersonalizada
        await t.test('personalizada mantém contrato US08 e recebe campos em operação separada', async () => {
            const criada = await requisitar('POST', '/atividades', a, { nome: 'Personalizada US09', modalidadeId: atividades[0].modalidadeId })
            assert.equal(criada.status, 201)
            personalizada = criada.body
            assert.ok(!('campos' in personalizada))
            assert.equal((await requisitar('GET', urlCampos(personalizada.id), a)).status, 409)
            assert.equal((await requisitar('POST', urlCriar(personalizada.id), a, { valores: { duracaoSegundos: 60 } })).status, 409)
            const resposta = await requisitar('POST', urlCampos(personalizada.id), a, bodyCampos)
            assert.equal(resposta.status, 201)
            assert.deepEqual(resposta.body, { atividadeId: personalizada.id, campos: [{ ...campoDuracao, unidade: 's' }] })
            assert.deepEqual(await ler('campos-configuracao-personalizadas.json'), [resposta.body])
            const consulta = await requisitar('GET', urlCampos(personalizada.id), a)
            assert.equal(consulta.status, 200)
            assert.deepEqual(consulta.body, resposta.body)
            const prescricao = await requisitar('POST', urlCriar(personalizada.id), a, { valores: { duracaoSegundos: 60 } })
            assert.equal(prescricao.status, 201)
            configuracaoPersonalizada = prescricao.body
        })

        await t.test('campos por atividade: personalizada de musculação aceita duração, sem herdar séries/carga', async () => {
            assert.equal((await requisitar('POST', urlCriar(personalizada.id), a, { valores: { series: 3, repeticoes: 10 } })).status, 400)
            assert.equal((await requisitar('POST', urlCriar(personalizada.id), a, { valores: { duracaoSegundos: 9 } })).status, 400)
            assert.equal((await requisitar('POST', urlCriar(personalizada.id), a, { valores: { duracaoSegundos: 601 } })).status, 400)
        })

        await t.test('isolamento de personalizada e configuração em todas as operações', async () => {
            const camposAntes = await fs.readFile(caminho('campos-configuracao-personalizadas.json'))
            const configuracoesAntes = await fs.readFile(caminho('configuracoes-atividades.json'))
            for (const [method, url, body] of [
                ['GET', urlCampos(personalizada.id)],
                ['POST', urlCampos(personalizada.id), bodyCampos],
                ['POST', urlCriar(personalizada.id), { valores: { duracaoSegundos: 60 } }],
                ['GET', urlConfiguracao(configuracaoPersonalizada.id)]
            ]) assert.equal((await requisitar(method, url, b, body)).status, 404)
            assert.deepEqual(await fs.readFile(caminho('campos-configuracao-personalizadas.json')), camposAntes)
            assert.deepEqual(await fs.readFile(caminho('configuracoes-atividades.json')), configuracoesAntes)
        })

        await t.test('definições de padrões são protegidas; definição pessoal não pode ser sobrescrita', async () => {
            assert.equal((await requisitar('POST', urlCampos(yoga), a, bodyCampos)).status, 403)
            assert.equal((await requisitar('POST', urlCampos(personalizada.id), a, bodyCampos)).status, 409)
            assert.deepEqual((await requisitar('GET', urlConfiguracao(configuracaoPersonalizada.id), a)).body, configuracaoPersonalizada)
        })

        const definicoesInvalidas = [
            ['tipo arbitrário', { campos: [{ ...campoDuracao, tipo: 'codigo' }] }],
            ['tipo incompatível', { campos: [{ ...campoDuracao, tipo: 'decimal' }] }],
            ['unidade incompatível', { campos: [{ ...campoDuracao, unidade: 'kg' }] }],
            ['limites invertidos', { campos: [{ ...campoDuracao, min: 100, max: 10 }] }],
            ['limite negativo', { campos: [{ ...campoDuracao, min: -1 }] }],
            ['limite fracionário de duração', { campos: [{ ...campoDuracao, min: 1.5 }] }],
            ['métrica desconhecida', { campos: [{ ...campoDuracao, chave: 'codigo' }] }],
            ['duplicidade', { campos: [campoDuracao, campoDuracao] }],
            ['lista vazia', { campos: [] }],
            ['obrigatorio ausente', { campos: [{ chave: 'series', tipo: 'inteiro' }] }],
            ['propriedade de execução', { campos: [{ ...campoDuracao, script: 'return true' }] }],
            ['profissionalId do cliente', { ...bodyCampos, profissionalId: profissionalB }]
        ]
        for (const [nome, body] of definicoesInvalidas) {
            await t.test(`definição inválida: ${nome} → 400`, async () => {
                const antes = await fs.readFile(caminho('campos-configuracao-personalizadas.json'))
                assert.equal((await requisitar('POST', urlCampos(personalizada.id), a, body)).status, 400)
                assert.deepEqual(await fs.readFile(caminho('campos-configuracao-personalizadas.json')), antes)
            })
        }

        await t.test('campos opcionais podem ser omitidos e limites/unidades ausentes recebem valores básicos', async () => {
            const criada = await requisitar('POST', '/atividades', b, { nome: 'Personalizada opcional B', modalidadeId: atividades[2].modalidadeId })
            assert.equal(criada.status, 201)
            const id = criada.body.id
            const resposta = await requisitar('POST', urlCampos(id), b, {
                campos: [{ chave: 'duracaoSegundos', tipo: 'duracao', obrigatorio: false }]
            })
            assert.equal(resposta.status, 201)
            assert.deepEqual(resposta.body.campos, [{ chave: 'duracaoSegundos', tipo: 'duracao', obrigatorio: false, unidade: 's', min: 1 }])
            assert.equal((await requisitar('POST', urlCriar(id), b, { valores: {} })).status, 201)
            assert.equal((await requisitar('GET', urlCampos(id), a)).status, 404)
        })

        await t.test('UUID inválido → 400; recurso ausente → 404 nas quatro rotas', async () => {
            for (const [id, status] of [['invalido', 400], [randomUUID(), 404]]) {
                for (const [method, url, body] of [
                    ['GET', urlCampos(id)],
                    ['POST', urlCampos(id), bodyCampos],
                    ['POST', urlCriar(id), { valores: { duracaoSegundos: 60 } }],
                    ['GET', urlConfiguracao(id)]
                ]) assert.equal((await requisitar(method, url, a, body)).status, status)
            }
        })

        const revogado = token(profissionalA)
        assert.equal((await requisitar('POST', '/logout', revogado)).status, 204)
        for (const [nome, credencial, status] of [
            ['STUDENT', token(estudante), 403],
            ['sem token', undefined, 401],
            ['token inválido', 'invalido', 401],
            ['assinatura incorreta', jwt.sign({ userId: profissionalA }, 'outro-segredo', { jwtid: randomUUID(), expiresIn: '1h' }), 401],
            ['token expirado', token(profissionalA, { expiresIn: -1 }), 401],
            ['token revogado', revogado, 401],
            ['usuário inexistente', token(randomUUID()), 401]
        ]) {
            await t.test(`${nome} → ${status} nas quatro operações`, async () => {
                const antes = await fs.readFile(caminho('configuracoes-atividades.json'))
                const camposAntes = await fs.readFile(caminho('campos-configuracao-personalizadas.json'))
                for (const [method, url, body] of [
                    ['GET', urlCampos(yoga)],
                    ['POST', urlCampos(personalizada.id), bodyCampos],
                    ['POST', urlCriar(yoga), { valores: { duracaoSegundos: 60 } }],
                    ['GET', urlConfiguracao(configuracao.id)]
                ]) assert.equal((await requisitar(method, url, credencial, body)).status, status)
                assert.deepEqual(await fs.readFile(caminho('configuracoes-atividades.json')), antes)
                assert.deepEqual(await fs.readFile(caminho('campos-configuracao-personalizadas.json')), camposAntes)
            })
        }

        await t.test('reinício preserva IDs, valores, campos personalizados, isolamento e revogação', async () => {
            const camposAntes = (await requisitar('GET', urlCampos(personalizada.id), a)).body
            await pararServidor(processo)
            processo = await iniciarServidor(temporario)
            for (const item of [configuracao, configuracaoPersonalizada]) {
                const resposta = await requisitar('GET', urlConfiguracao(item.id), a)
                assert.equal(resposta.status, 200)
                assert.deepEqual(resposta.body, item)
                assert.equal((await requisitar('GET', urlConfiguracao(item.id), b)).status, 404)
            }
            const camposDepois = await requisitar('GET', urlCampos(personalizada.id), a)
            assert.equal(camposDepois.status, 200)
            assert.deepEqual(camposDepois.body, camposAntes)
            assert.equal((await requisitar('GET', urlCampos(personalizada.id), b)).status, 404)
            assert.equal((await requisitar('POST', urlCriar(personalizada.id), a, { valores: { duracaoSegundos: 30 } })).status, 201)
            assert.equal((await requisitar('GET', urlConfiguracao(configuracao.id), revogado)).status, 401)
        })

        await t.test('gravações concorrentes de configurações preservam todos os registros', async () => {
            const arquivo = path.join(temporario, 'concorrencia-configuracoes.json')
            await fs.writeFile(arquivo, '[]')
            const repository = new JsonConfiguracaoRepository(arquivo)
            const novas = Array.from({ length: 20 }, () => ({ ...configuracao, id: randomUUID() }))
            await Promise.all(novas.map((item) => repository.criar(item)))
            assert.deepEqual(await repository.listar(), novas)
            assert.deepEqual(await repository.buscarPorId(novas[0].id), novas[0])
            assert.equal(await repository.buscarPorId(randomUUID()), null)
            await assert.rejects(fs.access(`${arquivo}.tmp`), { code: 'ENOENT' })
        })

        await t.test('gravações concorrentes de campos preservam IDs distintos e rejeitam duplicata sem bloquear a fila', async () => {
            const arquivo = path.join(temporario, 'concorrencia-campos.json')
            await fs.writeFile(arquivo, '[]')
            const repository = new JsonCamposRepository(caminho('campos-configuracao-atividades.json'), arquivo)
            const novas = Array.from({ length: 10 }, () => ({ atividadeId: randomUUID(), campos: [campoDuracao] }))
            await Promise.all(novas.map((item) => repository.criarPersonalizada(item)))
            const duplicada = { atividadeId: randomUUID(), campos: [campoDuracao] }
            const resultados = await Promise.allSettled([
                repository.criarPersonalizada(duplicada), repository.criarPersonalizada(duplicada)
            ])
            assert.equal(resultados.filter((item) => item.status === 'fulfilled').length, 1)
            assert.equal(resultados.find((item) => item.status === 'rejected').reason.statusCode, 409)
            const ultima = { atividadeId: randomUUID(), campos: [campoDuracao] }
            await repository.criarPersonalizada(ultima)
            assert.deepEqual(JSON.parse(await fs.readFile(arquivo, 'utf-8')), [...novas, duplicada, ultima])
            assert.deepEqual(await repository.buscarPorAtividade(ultima.atividadeId), ultima)
            await assert.rejects(fs.access(`${arquivo}.tmp`), { code: 'ENOENT' })
        })

        await t.test('catálogos permanentes permanecem idênticos; JSONs de execução contêm somente suas entidades', async () => {
            for (const nome of catalogos) assert.deepEqual(await fs.readFile(caminho(nome)), originais.get(nome))
            assert.ok((await ler('atividades-personalizadas.json')).every((item) => item.origem === 'PERSONALIZADA' && !('valores' in item)))
            assert.ok((await ler('campos-configuracao-personalizadas.json')).every((item) => item.atividadeId && item.campos))
            assert.ok((await ler('configuracoes-atividades.json')).every((item) => item.id && item.valores && !('atividade' in item)))
            assert.ok(!(await fs.readdir(caminho(''))).some((nome) => nome.endsWith('.tmp')))
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
