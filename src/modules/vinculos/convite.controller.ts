import { FastifyReply, FastifyRequest } from 'fastify'
import { JsonUserRepository } from '../users/repositories/json-user.repository.js'
import { JsonVinculoRepository } from './repositories/json-vinculo.repository.js'
import { JsonConviteRepository } from './repositories/json-convite.repository.js'
import { ConviteService } from './convite.service.js'

const userRepository = new JsonUserRepository('data/users.json')
const vinculoRepository = new JsonVinculoRepository('data/vinculos.json')
const conviteRepository = new JsonConviteRepository('data/convites.json')

const conviteService = new ConviteService(
    conviteRepository,
    vinculoRepository,
    userRepository
)

type ParametrosConvite = {
    codigo: string
}

export async function criarConviteController(
    request: FastifyRequest,
    reply: FastifyReply
) {
    try {
        const convite = await conviteService.criarConvite(request.user.userId)

        return reply.status(201).send(convite)
    } catch (error) {
        const mensagem = error instanceof Error
            ? error.message
            : 'Erro ao criar convite.'

        return reply.status(400).send({ mensagem })
    }
}

export async function buscarConviteController(
    request: FastifyRequest<{ Params: ParametrosConvite }>,
    reply: FastifyReply
) {
    try {
        const resultado = await conviteService.buscarConvite(
            request.params.codigo
        )

        return reply.status(200).send(resultado)
    } catch (error) {
        const mensagem = error instanceof Error
            ? error.message
            : 'Erro ao buscar convite.'

        return reply.status(404).send({ mensagem })
    }
}

export async function aceitarConviteController(
    request: FastifyRequest<{ Params: ParametrosConvite }>,
    reply: FastifyReply
) {
    try {
        const convite = await conviteService.aceitarConvite(
            request.params.codigo,
            request.user.userId
        )

        return reply.status(200).send(convite)
    } catch (error) {
        const mensagem = error instanceof Error
            ? error.message
            : 'Erro ao aceitar convite.'

        return reply.status(400).send({ mensagem })
    }
}

export async function recusarConviteController(
    request: FastifyRequest<{ Params: ParametrosConvite }>,
    reply: FastifyReply
) {
    try {
        const convite = await conviteService.recusarConvite(
            request.params.codigo,
            request.user.userId
        )

        return reply.status(200).send(convite)
    } catch (error) {
        const mensagem = error instanceof Error
            ? error.message
            : 'Erro ao recusar convite.'

        return reply.status(400).send({ mensagem })
    }
}