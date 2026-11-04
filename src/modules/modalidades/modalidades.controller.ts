import { FastifyReply, FastifyRequest } from 'fastify'
import { JsonModalidadeRepository } from './repositories/json-modalidade.repository.js'
import { ModalidadeNaoEncontradaError } from './modalidades.errors.js'
import { DefinirModalidadesBody, definirModalidadesSchema } from './modalidades.schema.js'
import { ModalidadeService } from './modalidades.service.js'

const modalidadeRepository = new JsonModalidadeRepository('data/modalidades.json', 'data/profissional-modalidades.json')
const modalidadeService = new ModalidadeService(modalidadeRepository)

export async function listarModalidadesController(request: FastifyRequest, reply: FastifyReply) {
    const modalidades = await modalidadeService.listarCatalogo()
    return reply.status(200).send(modalidades)
}

export async function listarMinhasModalidadesController(request: FastifyRequest, reply: FastifyReply) {
    const modalidades = await modalidadeService.listarMinhasModalidades(request.user.userId)
    return reply.status(200).send(modalidades)
}

export async function definirModalidadesController(request: FastifyRequest<{ Body: DefinirModalidadesBody }>, reply: FastifyReply) {
    const resultado = definirModalidadesSchema.safeParse(request.body)

    if (!resultado.success) {
        return reply.status(400).send('Formato de dados inválido!')
    }

    try {
        const modalidades = await modalidadeService.definirModalidades(request.user.userId, resultado.data)
        return reply.status(200).send(modalidades)
    } catch (error) {
        if (error instanceof ModalidadeNaoEncontradaError) {
            return reply.status(400).send(error.message)
        }
        throw error
    }
}
