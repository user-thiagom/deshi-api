import { dataPath } from '../../config/data.js'
import { FastifyReply, FastifyRequest } from 'fastify'
import { PrismaConviteRepository, PrismaUserRepository, PrismaVinculoRepository } from '../../shared/database/repositories.js'
import {
    AlunoNaoEncontradoError,
    SolicitacaoNaoPertenceAoAlunoError,
    UsuarioNaoEhAlunoError,
    VinculoConsigoMesmoError,
    VinculoJaExistenteError,
    VinculoNaoEncontradoError,
    VinculoNaoEstaPendenteError
} from './vinculos.errors.js'
import { paraRespostaVinculo } from './vinculos.mapper.js'
import { CriarVinculoBody, criarVinculoSchema, ParametrosVinculo, parametrosVinculoSchema } from './vinculos.schema.js'
import { VinculoService } from './vinculos.service.js'

const vinculoRepository = new PrismaVinculoRepository()
const userRepository = new PrismaUserRepository()
const conviteRepository = new PrismaConviteRepository()
const vinculoService = new VinculoService(vinculoRepository, userRepository, conviteRepository)

function responderErroVinculo(error: unknown, reply: FastifyReply) {
    if (error instanceof AlunoNaoEncontradoError || error instanceof VinculoNaoEncontradoError) {
        return reply.status(404).send(error.message)
    }

    if (error instanceof UsuarioNaoEhAlunoError || error instanceof VinculoConsigoMesmoError) {
        return reply.status(400).send(error.message)
    }

    if (error instanceof SolicitacaoNaoPertenceAoAlunoError) {
        return reply.status(403).send(error.message)
    }

    if (error instanceof VinculoJaExistenteError || error instanceof VinculoNaoEstaPendenteError) {
        return reply.status(409).send(error.message)
    }

    throw error
}

export async function listarAlunosVinculadosController(request: FastifyRequest, reply: FastifyReply) {
    const alunos = await vinculoService.listarAlunosVinculados(request.user.userId)
    return reply.status(200).send(alunos)
}

export async function listarProfissionaisVinculadosController(request: FastifyRequest, reply: FastifyReply) {
    const profissionais = await vinculoService.listarProfissionaisVinculados(request.user.userId)
    return reply.status(200).send(profissionais)
}

export async function removerAlunoVinculadoController(
    request: FastifyRequest<{ Params: { studentId: string } }>,
    reply: FastifyReply
) {
    const studentId = request.params.studentId
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(studentId)) {
        return reply.status(400).send({ message: 'Identificador de aluno inválido.' })
    }

    try {
        await vinculoService.removerAlunoVinculado(request.user.userId, studentId)
        return reply.status(204).send()
    } catch (error) {
        if (error instanceof VinculoNaoEncontradoError) {
            return reply.status(404).send({ message: error.message })
        }
        request.log.error(error)
        return reply.status(500).send({ message: 'Erro ao remover o aluno vinculado.' })
    }
}

export async function criarVinculoController(request: FastifyRequest<{ Body: CriarVinculoBody }>, reply: FastifyReply) {
    const resultado = criarVinculoSchema.safeParse(request.body)

    if (!resultado.success) {
        return reply.status(400).send('Formato de dados inválido!')
    }

    try {
        const vinculo = await vinculoService.criarSolicitacao(request.user.userId, resultado.data)
        return reply.status(201).send(paraRespostaVinculo(vinculo))
    } catch (error) {
        return responderErroVinculo(error, reply)
    }
}

async function responderSolicitacaoController(
    request: FastifyRequest<{ Params: ParametrosVinculo }>,
    reply: FastifyReply,
    acao: 'aceitar' | 'recusar'
) {
    const resultado = parametrosVinculoSchema.safeParse(request.params)

    if (!resultado.success) {
        return reply.status(400).send('Formato de dados inválido!')
    }

    try {
        const vinculo = acao === 'aceitar'
            ? await vinculoService.aceitarSolicitacao(resultado.data.id, request.user.userId)
            : await vinculoService.recusarSolicitacao(resultado.data.id, request.user.userId)

        return reply.status(200).send(paraRespostaVinculo(vinculo))
    } catch (error) {
        return responderErroVinculo(error, reply)
    }
}

export async function aceitarVinculoController(request: FastifyRequest<{ Params: ParametrosVinculo }>, reply: FastifyReply) {
    return responderSolicitacaoController(request, reply, 'aceitar')
}

export async function recusarVinculoController(request: FastifyRequest<{ Params: ParametrosVinculo }>, reply: FastifyReply) {
    return responderSolicitacaoController(request, reply, 'recusar')
}
