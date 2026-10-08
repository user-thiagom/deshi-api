import { FastifyInstance } from 'fastify'
import { createUserController, loginController } from './users.controller.js'

export async function userRoutes(server: FastifyInstance) {
    server.post('/users', createUserController)
    server.post('/login', loginController)
}