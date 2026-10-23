import { FastifyReply, FastifyRequest } from 'fastify'
import { JsonVinculoRepository } from '../vinculos/repositories/json-vinculo.repository.js'
import { JsonAtividadeRepository } from '../atividades/repositories/json-atividade.repository.js'
import { JsonModalidadeRepository } from '../modalidades/repositories/json-modalidade.repository.js'
import { JsonCamposRepository } from '../configuracoes-atividades/repositories/json-campos.repository.js'
import { JsonProgramaRepository } from './repositories/json-programa.repository.js'
import { ProgramaService } from './programas.service.js'
import { ProgramaError } from './programas.errors.js'
import { CriarProgramaBody, criarProgramaSchema } from './programas.schema.js'

const programaService = new ProgramaService(
    new JsonProgramaRepository('data/programas.json'),
    new JsonVinculoRepository('data/vinculos.json'),
    new JsonAtividadeRepository(
        'data/atividades.json',
        'data/atividades-personalizadas.json'
    ),
    new JsonModalidadeRepository(
        'data/modalidades.json',
        'data/profissional-modalidades.json'
    ),
    new JsonCamposRepository(
        'data/campos-configuracao-atividades.json',
        'data/campos-configuracao-personalizadas.json'
    )
)

export async function criarProgramaController(
    request: FastifyRequest<{ Body: CriarProgramaBody }>,
    reply: FastifyReply
) {
    const resultado = criarProgramaSchema.safeParse(request.body)

    if (!resultado.success) {
        return reply.status(400).send('Formato de dados inválido!')
    }

    try {
        const programa = await programaService.criar(
            request.user.userId,
            resultado.data
        )

        return reply.status(201).send(programa)
    } catch (error) {
        if (error instanceof ProgramaError) {
            return reply.status(error.statusCode).send(error.message)
        }

        throw error
    }
}