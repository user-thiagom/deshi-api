import type { FastifyInstance, preHandlerHookHandler } from 'fastify'

import { authenticate } from '../../shared/auth/authenticate.js'
import { createStartSessionController } from './sessions.controller.js'
import type { SessionsService } from './sessions.service.js'

export interface SessionRouteDependencies {
    sessionsService?: SessionsService
    authenticate?: preHandlerHookHandler
}

export async function sessionRoutes(
    server: FastifyInstance,
    dependencies: SessionRouteDependencies = {}
) {
    server.post('/sessions', {
        preHandler: dependencies.authenticate ?? authenticate
    }, createStartSessionController(dependencies.sessionsService))
}