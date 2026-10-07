import { FastifyInstance } from 'fastify'
import { createUserController } from './users.controller.js'

export async function userRoutes(server: FastifyInstance) {
    server.post('/users', createUserController)
}