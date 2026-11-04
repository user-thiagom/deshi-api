
import type { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { SessionsService } from './sessions.service.js'
import { registerExecutionSchema } from './sessions-execution.schema.js'
import {
    SessionNotFoundError,
    SessionNotOwnedByStudentError,
    SessionActivityNotFoundError
} from './sessions.errors.js'

export function registerExecutionController(
    sessionsService: SessionsService
) {
    return async function (
        request: FastifyRequest,
        reply: FastifyReply
    ) {
        const body = request.body as {
            activityId: string
            values: Record<string, number>
            status: 'COMPLETED' | 'INCOMPLETE'
        }

        const result = registerExecutionSchema.safeParse({
            activityId: body.activityId,
            values: body.values,
            status: body.status,
            sessionId: (request.params as { sessionId: string }).sessionId
        })

        if (!result.success) {
            return reply.status(400).send({
                message: 'Dados inválidos.',
                errors: z.treeifyError(result.error)
            })
        }

        try {
            const session = await sessionsService.registerExecution(
                result.data.sessionId,
                request.user.userId,
                result.data.activityId,
                result.data.values,
                result.data.status
            )

            return reply.status(200).send(session)
        } catch (error) {
            if (error instanceof SessionNotFoundError) {
                return reply.status(404).send({ message: error.message })
            }

            if (
                error instanceof SessionNotOwnedByStudentError ||
                error instanceof SessionActivityNotFoundError
            ) {
                return reply.status(403).send({ message: error.message })
            }

            request.log.error(error)
            return reply.status(500).send({
                message: 'Erro interno ao registrar execução.'
            })
        }
    }
}
