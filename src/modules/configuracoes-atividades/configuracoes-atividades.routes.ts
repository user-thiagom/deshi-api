import { FastifyInstance } from 'fastify'
import { authenticate } from '../../shared/auth/authenticate.js'
import { authorizeProfile } from '../../shared/auth/authorize-profile.js'
import { buscarConfiguracaoController, consultarCamposController, criarConfiguracaoController, definirCamposController } from './configuracoes-atividades.controller.js'
import { CriarConfiguracaoBody, DefinirCamposBody, IdParams } from './configuracoes-atividades.schema.js'

export async function configuracaoAtividadeRoutes(server: FastifyInstance) {
    const protecao = { preHandler: [authenticate, authorizeProfile('PROFESSIONAL')] }
    server.get<{ Params: IdParams }>('/atividades/:id/campos-configuracao', protecao, consultarCamposController)
    server.post<{ Params: IdParams; Body: DefinirCamposBody }>('/atividades/:id/campos-configuracao', protecao, definirCamposController)
    server.post<{ Params: IdParams; Body: CriarConfiguracaoBody }>('/atividades/:id/configuracoes', protecao, criarConfiguracaoController)
    server.get<{ Params: IdParams }>('/configuracoes-atividades/:id', protecao, buscarConfiguracaoController)
}
