import { FastifyReply, FastifyRequest } from 'fastify'
import { JsonUserRepository } from '../users/repositories/json-user.repository.js'
import { JsonVinculoRepository } from './repositories/json-vinculo.repository.js'
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

const vinculoRepository = new JsonVinculoRepository('data/vinculos.json')
const userRepository = new JsonUserRepository('data/users.json')
const vinculoService = new VinculoService(vinculoRepository, userRepository)

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
