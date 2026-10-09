import { FastifyReply, FastifyRequest } from 'fastify'
import jwt from 'jsonwebtoken'
import { env } from '../../config/env.js'
import { JsonTokenRevocationRepository } from './repositories/json-token-revocation.repository.js'

const tokenRevocationRepository = new JsonTokenRevocationRepository(
    'data/revoked-tokens.json'
)

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
    const authorization = request.headers.authorization

    if (!authorization?.startsWith('Bearer ')) {
        return reply.status(401).send({
            message: 'Token de autenticação não informado.'
        })
    }

    const token = authorization.slice('Bearer '.length)

    try {
        const payload = jwt.verify(token, env.jwtSecret)

        if (
            typeof payload === 'string' ||
            typeof payload.userId !== 'string' ||
            typeof payload.jti !== 'string' ||
            typeof payload.exp !== 'number'
        ) {
            return reply.status(401).send({
                message: 'Token de autenticação inválido.'
            })
        }

        const isRevoked = await tokenRevocationRepository.isRevoked(
            payload.jti
        )

        if (isRevoked) {
            return reply.status(401).send({
                message: 'Token revogado.'
            })
        }

        request.user = {
            userId: payload.userId,
            jti: payload.jti,
            exp: payload.exp
        }
        
    } catch {
        return reply.status(401).send({
            message: 'Token inválido ou expirado.'
        })
    }
}