import type { FastifyInstance } from 'fastify'

import { authenticate } from '../../shared/auth/authenticate.js'
import { startSessionController } from './sessions.controller.js'

export async function sessionRoutes(server: FastifyInstance) {
    server.post( '/sessions', { preHandler: authenticate }, startSessionController )
}