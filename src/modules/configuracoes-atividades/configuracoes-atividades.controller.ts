import { FastifyReply, FastifyRequest } from 'fastify'
import { JsonAtividadeRepository } from '../atividades/repositories/json-atividade.repository.js'
import { JsonCamposRepository } from './repositories/json-campos.repository.js'
import { JsonConfiguracaoRepository } from './repositories/json-configuracao.repository.js'
import { ConfiguracaoAtividadeService } from './configuracoes-atividades.service.js'
import { ConfiguracaoError } from './configuracoes-atividades.errors.js'
import { CriarConfiguracaoBody, DefinirCamposBody, IdParams, criarConfiguracaoSchema, definirCamposSchema, idSchema } from './configuracoes-atividades.schema.js'

const service = new ConfiguracaoAtividadeService(
    new JsonAtividadeRepository('data/atividades.json', 'data/atividades-personalizadas.json'),
    new JsonCamposRepository('data/campos-configuracao-atividades.json', 'data/campos-configuracao-personalizadas.json'),
    new JsonConfiguracaoRepository('data/configuracoes-atividades.json')
)

function tratarErro(error: unknown, reply: FastifyReply) {
    if (error instanceof ConfiguracaoError) {
        return reply.status(error.statusCode).send({ message: error.message })
    }
    throw error
}

export async function consultarCamposController(request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
    const params = idSchema.safeParse(request.params)
    if (!params.success) return reply.status(400).send({ message: 'UUID inválido.' })
    try {
        return reply.status(200).send(await service.consultarCampos(params.data.id, request.user.userId))
    } catch (error) {
        return tratarErro(error, reply)
    }
}

export async function definirCamposController(request: FastifyRequest<{ Params: IdParams; Body: DefinirCamposBody }>, reply: FastifyReply) {
    const params = idSchema.safeParse(request.params)
    const body = definirCamposSchema.safeParse(request.body)
    if (!params.success || !body.success) return reply.status(400).send({ message: 'Formato de dados inválido!' })
    try {
        return reply.status(201).send(await service.definirCampos(params.data.id, request.user.userId, body.data))
    } catch (error) {
        return tratarErro(error, reply)
    }
}

export async function criarConfiguracaoController(request: FastifyRequest<{ Params: IdParams; Body: CriarConfiguracaoBody }>, reply: FastifyReply) {
    const params = idSchema.safeParse(request.params)
    const body = criarConfiguracaoSchema.safeParse(request.body)
    if (!params.success || !body.success) return reply.status(400).send({ message: 'Formato de dados inválido!' })
    try {
        return reply.status(201).send(await service.criar(params.data.id, request.user.userId, body.data))
    } catch (error) {
        return tratarErro(error, reply)
    }
}

export async function buscarConfiguracaoController(request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
    const params = idSchema.safeParse(request.params)
    if (!params.success) return reply.status(400).send({ message: 'UUID inválido.' })
    try {
        return reply.status(200).send(await service.buscarPorId(params.data.id, request.user.userId))
    } catch (error) {
        return tratarErro(error, reply)
    }
}
