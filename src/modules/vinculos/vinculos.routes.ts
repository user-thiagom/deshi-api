import { FastifyInstance } from 'fastify'
import { authenticate } from '../../shared/auth/authenticate.js'
import { authorizeProfile } from '../../shared/auth/authorize-profile.js'
import { aceitarVinculoController, criarVinculoController, recusarVinculoController } from './vinculos.controller.js'
import { CriarVinculoBody, ParametrosVinculo } from './vinculos.schema.js'

export async function vinculoRoutes(server: FastifyInstance) {
    server.post<{ Body: CriarVinculoBody }>('/vinculos', {
        preHandler: [authenticate, authorizeProfile('PROFESSIONAL')]
    }, criarVinculoController)

    server.patch<{ Params: ParametrosVinculo }>('/vinculos/:id/aceitar', {
        preHandler: [authenticate, authorizeProfile('STUDENT')]
    }, aceitarVinculoController)

    server.patch<{ Params: ParametrosVinculo }>('/vinculos/:id/recusar', {
        preHandler: [authenticate, authorizeProfile('STUDENT')]
    }, recusarVinculoController)
}
