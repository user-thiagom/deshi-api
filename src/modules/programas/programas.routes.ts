
import { FastifyInstance } from 'fastify'
import { authenticate } from '../../shared/auth/authenticate.js'
import { authorizeProfile } from '../../shared/auth/authorize-profile.js'
import {
    criarProgramaController,
    listarProgramasController,
    buscarProgramaController,
    editarProgramaController
} from './programas.controller.js'
import {
    CriarProgramaBody,
    EditarProgramaBody
} from './programas.schema.js'

export async function programaRoutes(server: FastifyInstance) {
    server.post<{ Body: CriarProgramaBody }>('/programas', {
        preHandler: [authenticate, authorizeProfile('PROFESSIONAL')]
    }, criarProgramaController)

    server.get('/programas', {
        preHandler: [authenticate]
    }, listarProgramasController)

    server.get<{ Params: { id: string } }>('/programas/:id', {
        preHandler: [authenticate]
    }, buscarProgramaController)

    server.put<{ Params: { id: string }; Body: EditarProgramaBody }>(
        '/programas/:id',
        {
            preHandler: [
                authenticate,
                authorizeProfile('PROFESSIONAL')
            ]
        },
        editarProgramaController
    )
}

