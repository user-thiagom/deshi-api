import { CriarConviteBody, ParametrosConvite } from './convite.schema.js'
import { FastifyInstance } from 'fastify'
import { authenticate } from '../../shared/auth/authenticate.js'
import { authorizeProfile } from '../../shared/auth/authorize-profile.js'
import {
    criarConviteController,
    buscarConviteController,
    aceitarConviteController,
    recusarConviteController
} from './convite.controller.js'

export async function conviteRoutes(server: FastifyInstance) {
    server.post<{ Body: CriarConviteBody }>('/vinculos/convites', {
        preHandler: [authenticate, authorizeProfile('PROFESSIONAL')]
    }, criarConviteController)

    server.get<{ Params: ParametrosConvite }>('/vinculos/convites/:codigo', {
        preHandler: [authenticate, authorizeProfile('STUDENT')]
    }, buscarConviteController)

    server.post<{ Params: ParametrosConvite }>('/vinculos/convites/:codigo/aceitar', {
        preHandler: [authenticate, authorizeProfile('STUDENT')]
    }, aceitarConviteController)

    server.post<{ Params: ParametrosConvite }>('/vinculos/convites/:codigo/recusar', {
        preHandler: [authenticate, authorizeProfile('STUDENT')]
    }, recusarConviteController)
}
