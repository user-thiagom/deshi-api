import { dataPath } from '../../config/data.js'
import { criarConvitePorEmailSchema, criarConviteSchema, parametrosConviteSchema, CriarConviteBody, CriarConvitePorEmailBody, ParametrosConvite } from './convite.schema.js'
import { ConviteError, FalhaRollbackConviteError } from './convite.errors.js'
import { AlunoNaoEncontradoError, UsuarioNaoEhAlunoError, VinculoConsigoMesmoError, VinculoJaExistenteError } from './vinculos.errors.js'
import { FastifyReply, FastifyRequest } from 'fastify'
import { PrismaUserRepository, PrismaVinculoRepository, PrismaConviteRepository } from '../../shared/database/repositories.js'
import { ConviteService } from './convite.service.js'

const userRepository = new PrismaUserRepository()
const vinculoRepository = new PrismaVinculoRepository()
const conviteRepository = new PrismaConviteRepository()

const conviteService = new ConviteService(
    conviteRepository,
    vinculoRepository,
    userRepository
)

function responderErroConvite(error: unknown, reply: FastifyReply) {
    if (error instanceof ConviteError) {
        return reply.status(error.statusCode).send({ mensagem: error.message })
    }
    if (error instanceof AlunoNaoEncontradoError) {
        return reply.status(404).send({ mensagem: error.message })
    }
    if (error instanceof UsuarioNaoEhAlunoError || error instanceof VinculoConsigoMesmoError) {
        return reply.status(400).send({ mensagem: error.message })
    }
    if (error instanceof VinculoJaExistenteError) {
        return reply.status(409).send({ mensagem: error.message })
    }

    reply.log.error({ err: error }, 'Falha na operação de convite.')
    const mensagem = error instanceof FalhaRollbackConviteError
        ? error.message : 'Erro interno ao processar convite.'
    return reply.status(500).send({ mensagem })
}

export async function criarConviteController(
    request: FastifyRequest<{ Body: CriarConviteBody }>,
    reply: FastifyReply
) {
    const resultado = criarConviteSchema.safeParse(request.body)
    if (!resultado.success) {
        return reply.status(400).send({ mensagem: 'Formato de dados inválido!' })
    }

    try {
        const { alunoId } = resultado.data

        const convite = await conviteService.criarConvite(
            request.user.userId,
            alunoId
        )

        return reply.status(201).send(convite)
    } catch (error) {
        return responderErroConvite(error, reply)
    }
}

export async function criarConvitePorEmailController(
    request: FastifyRequest<{ Body: CriarConvitePorEmailBody }>,
    reply: FastifyReply
) {
    const resultado = criarConvitePorEmailSchema.safeParse(request.body)
    if (!resultado.success) {
        return reply.status(400).send({ mensagem: 'Informe um e-mail válido.' })
    }

    try {
        const convite = await conviteService.criarConvitePorEmail(
            request.user.userId,
            resultado.data.email
        )
        return reply.status(201).send(convite)
    } catch (error) {
        return responderErroConvite(error, reply)
    }
}

export async function listarConvitesPendentesController(
    request: FastifyRequest,
    reply: FastifyReply
) {
    try {
        return reply.status(200).send(await conviteService.listarConvitesPendentes(request.user.userId))
    } catch (error) {
        request.log.error({ err: error }, 'Falha ao consultar convites pendentes.')
        return reply.status(500).send({ mensagem: 'Não foi possível carregar os convites pendentes.' })
    }
}

export async function buscarConviteController(
    request: FastifyRequest<{ Params: ParametrosConvite }>,
    reply: FastifyReply
) {
    const parametros = parametrosConviteSchema.safeParse(request.params)
    if (!parametros.success) {
        return reply.status(400).send({ mensagem: 'Formato de dados inválido!' })
    }

    try {
        const resultado = await conviteService.buscarConvite(
            parametros.data.codigo,
            request.user.userId
        )

        return reply.status(200).send(resultado)
    } catch (error) {
        return responderErroConvite(error, reply)
    }
}

export async function aceitarConviteController(
    request: FastifyRequest<{ Params: ParametrosConvite }>,
    reply: FastifyReply
) {
    const parametros = parametrosConviteSchema.safeParse(request.params)
    if (!parametros.success) {
        return reply.status(400).send({ mensagem: 'Formato de dados inválido!' })
    }

    try {
        const convite = await conviteService.aceitarConvite(
            parametros.data.codigo,
            request.user.userId
        )

        return reply.status(200).send(convite)
    } catch (error) {
        return responderErroConvite(error, reply)
    }
}

export async function recusarConviteController(
    request: FastifyRequest<{ Params: ParametrosConvite }>,
    reply: FastifyReply
) {
    const parametros = parametrosConviteSchema.safeParse(request.params)
    if (!parametros.success) {
        return reply.status(400).send({ mensagem: 'Formato de dados inválido!' })
    }

    try {
        const convite = await conviteService.recusarConvite(
            parametros.data.codigo,
            request.user.userId
        )

        return reply.status(200).send(convite)
    } catch (error) {
        return responderErroConvite(error, reply)
    }
}
