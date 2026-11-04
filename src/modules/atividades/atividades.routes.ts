import { FastifyInstance } from 'fastify'
import { authenticate } from '../../shared/auth/authenticate.js'
import { authorizeProfile } from '../../shared/auth/authorize-profile.js'
import { criarAtividadeController, listarAtividadesController } from './atividades.controller.js'
import { CriarAtividadeBody, ListarAtividadesQuery } from './atividades.schema.js'

export async function atividadeRoutes(server: FastifyInstance) {
    server.get<{ Querystring: ListarAtividadesQuery }>('/atividades', {
        preHandler: [authenticate, authorizeProfile('PROFESSIONAL')]
    }, listarAtividadesController)

    server.post<{ Body: CriarAtividadeBody }>('/atividades', {
        preHandler: [authenticate, authorizeProfile('PROFESSIONAL')]
    }, criarAtividadeController)
}
