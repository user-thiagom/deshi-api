import type { FastifyReply, FastifyRequest } from 'fastify'
import path from 'node:path'

import { JsonProgramRepository } from '../programs/repositories/json-program.repository.js'
import { JsonSessionRepository } from './repositories/json-session.repository.js'
import { SessionsService } from './sessions.service.js'
import { startSessionSchema } from './sessions.schema.js'
import { ProgramNotFoundError, ProgramNotOwnedByStudentError } from './sessions.errors.js'

const programRepository = new JsonProgramRepository(
    path.resolve(process.cwd(), 'data', 'programs.json')
)

const sessionRepository = new JsonSessionRepository(
    path.resolve(process.cwd(), 'data', 'sessions.json')
)

const sessionsService = new SessionsService(
    programRepository,
    sessionRepository
)

export async function startSessionController(
    request: FastifyRequest,
    reply: FastifyReply
) {
    const result = startSessionSchema.safeParse(request.body)

    if (!result.success) {
        return reply.code(400).send({
            message: 'Dados inválidos.',
            errors: result.error.flatten()
        })
    }

    try {
        const session = await sessionsService.startSession(
            result.data.programId,
            request.user.userId
        )

        return reply.code(201).send(session)
    } catch (error) {
        if (error instanceof ProgramNotFoundError) {
            return reply.code(404).send({
                message: error.message
            })
        }

        if (error instanceof ProgramNotOwnedByStudentError) {
            return reply.code(403).send({
                message: error.message
            })
        }

        request.log.error(error)

        return reply.code(500).send({
            message: 'Erro interno ao iniciar a sessão.'
        })
    }
}