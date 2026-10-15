import { FastifyInstance } from 'fastify'
import { authenticate } from '../../shared/auth/authenticate.js'
import { authorizeProfile } from '../../shared/auth/authorize-profile.js'
import { aceitarVinculoController, criarVinculoController, listarAlunosVinculadosController, listarProfissionaisVinculadosController, recusarVinculoController } from './vinculos.controller.js'
import { CriarVinculoBody, ParametrosVinculo } from './vinculos.schema.js'

export async function vinculoRoutes(server: FastifyInstance) {
    server.get('/vinculos/alunos', {
        preHandler: [authenticate, authorizeProfile('PROFESSIONAL')]
    }, listarAlunosVinculadosController)

    server.get('/vinculos/profissionais', {
        preHandler: [authenticate, authorizeProfile('STUDENT')]
    }, listarProfissionaisVinculadosController)

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
