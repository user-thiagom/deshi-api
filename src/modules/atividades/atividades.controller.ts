import { FastifyReply, FastifyRequest } from 'fastify'
import { JsonModalidadeRepository } from '../modalidades/repositories/json-modalidade.repository.js'
import { JsonAtividadeRepository } from './repositories/json-atividade.repository.js'
import { AtividadeService } from './atividades.service.js'
import { ModalidadeDaAtividadeNaoEncontradaError } from './atividades.errors.js'
import { CriarAtividadeBody, ListarAtividadesQuery, criarAtividadeSchema, listarAtividadesSchema } from './atividades.schema.js'

const atividadeService = new AtividadeService(
    new JsonAtividadeRepository('data/atividades.json', 'data/atividades-personalizadas.json'),
    new JsonModalidadeRepository('data/modalidades.json', 'data/profissional-modalidades.json')
)

export async function listarAtividadesController(request: FastifyRequest<{ Querystring: ListarAtividadesQuery }>, reply: FastifyReply) {
    const resultado = listarAtividadesSchema.safeParse(request.query)
    if (!resultado.success) {
        return reply.status(400).send('Formato de dados inválido!')
    }

    try {
        const atividades = await atividadeService.listar(request.user.userId, resultado.data)
        return reply.status(200).send(atividades)
    } catch (error) {
        if (error instanceof ModalidadeDaAtividadeNaoEncontradaError) {
            return reply.status(400).send(error.message)
        }
        throw error
    }
}

export async function criarAtividadeController(request: FastifyRequest<{ Body: CriarAtividadeBody }>, reply: FastifyReply) {
    const resultado = criarAtividadeSchema.safeParse(request.body)
    if (!resultado.success) {
        return reply.status(400).send('Formato de dados inválido!')
    }

    try {
        const atividade = await atividadeService.criar(request.user.userId, resultado.data)
        return reply.status(201).send(atividade)
    } catch (error) {
        if (error instanceof ModalidadeDaAtividadeNaoEncontradaError) {
            return reply.status(400).send(error.message)
        }
        throw error
    }
}
