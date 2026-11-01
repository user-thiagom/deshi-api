import { FastifyInstance } from 'fastify'
import { authenticate } from '../../shared/auth/authenticate.js'
import { authorizeProfile } from '../../shared/auth/authorize-profile.js'
import { definirModalidadesController, listarMinhasModalidadesController, listarModalidadesController } from './modalidades.controller.js'
import { DefinirModalidadesBody } from './modalidades.schema.js'

export async function modalidadeRoutes(server: FastifyInstance) {
    server.get('/modalidades', {
        preHandler: [authenticate, authorizeProfile('PROFESSIONAL')]
    }, listarModalidadesController)

    server.get('/modalidades/minhas', {
        preHandler: [authenticate, authorizeProfile('PROFESSIONAL')]
    }, listarMinhasModalidadesController)

    server.put<{ Body: DefinirModalidadesBody }>('/modalidades/minhas', {
        preHandler: [authenticate, authorizeProfile('PROFESSIONAL')]
    }, definirModalidadesController)
}
