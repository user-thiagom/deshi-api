import { FastifyInstance } from 'fastify'
import { authenticate } from '../../shared/auth/authenticate.js'
import { authorizeProfile } from '../../shared/auth/authorize-profile.js'
import { atualizarAtividadeController, criarAtividadeController, listarAtividadesController } from './atividades.controller.js'
import { AtualizarAtividadeBody, CriarAtividadeBody, ListarAtividadesQuery } from './atividades.schema.js'

export async function atividadeRoutes(server: FastifyInstance) {
    server.get<{ Querystring: ListarAtividadesQuery }>('/atividades', {
        preHandler: [authenticate, authorizeProfile('PROFESSIONAL')]
    }, listarAtividadesController)

    server.post<{ Body: CriarAtividadeBody }>('/atividades', {
        preHandler: [authenticate, authorizeProfile('PROFESSIONAL')]
    }, criarAtividadeController)

    server.put<{ Params: { id: string }; Body: AtualizarAtividadeBody }>('/atividades/:id', {
        preHandler: [authenticate, authorizeProfile('PROFESSIONAL')]
    }, atualizarAtividadeController)
}
