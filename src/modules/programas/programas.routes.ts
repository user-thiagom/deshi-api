import { FastifyInstance } from 'fastify'
import { authenticate } from '../../shared/auth/authenticate.js'
import { authorizeProfile } from '../../shared/auth/authorize-profile.js'
import {
    criarProgramaController,
    listarProgramasController
} from './programas.controller.js'
import { CriarProgramaBody } from './programas.schema.js'


export async function programaRoutes(server: FastifyInstance) {
    server.post<{ Body: CriarProgramaBody }>('/programas', {
        preHandler: [authenticate, authorizeProfile('PROFESSIONAL')]
    }, criarProgramaController)

    server.get('/programas', {
        preHandler: [authenticate]
    }, listarProgramasController)
}
