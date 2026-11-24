
import { FastifyReply, FastifyRequest } from 'fastify'
import { UserProfile } from '../../modules/users/users.types.js'
import { PrismaUserRepository } from '../database/repositories.js'

const userRepository = new PrismaUserRepository()

export function authorizeProfile(requiredProfile: UserProfile) {
    return async function (request: FastifyRequest, reply: FastifyReply) {
        const user = await userRepository.findById(request.user.userId)

        if (!user) {
            return reply.status(401).send({
                message: 'Usuário não encontrado.'
            })
        }

        if (user.profile !== requiredProfile) {
            return reply.status(403).send({
                message: 'Você não tem permissão para acessar este recurso.'
            })
        }
    }
}
