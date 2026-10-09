import { FastifyInstance } from 'fastify'
import { createUserController, loginController, logoutController } from './users.controller.js'
import { authenticate } from '../../shared/auth/authenticate.js'

export async function userRoutes(server: FastifyInstance) {
    server.post('/users', createUserController)
    server.post('/login', loginController)
    server.post('/logout', { preHandler: authenticate }, logoutController)
    server.get('/protected-test', { preHandler: authenticate }, async (request) => {
        return {
            message: 'Acesso autorizado!',
            userId: request.user.userId
        }
    }
    )
}