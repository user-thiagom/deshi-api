import type { FastifyReply, FastifyRequest } from 'fastify'

import { SessionsService } from './sessions.service.js'
import {
  SessionNotFoundError,
  SessionNotOwnedByStudentError,
  SessionActivityNotFoundError,
  InvalidActivityStateError
} from './sessions.errors.js'

export function resumeActivityController(
  sessionsService: SessionsService
) {
  return async function (
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const { sessionId, activityId } = request.params as {
      sessionId: string
      activityId: string
    }

    try {
      const session = await sessionsService.resumeActivity(
        sessionId,
        request.user.userId,
        activityId
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

      if (error instanceof InvalidActivityStateError) {
        return reply.status(409).send({ message: error.message })
      }

      request.log.error(error)

      return reply.status(500).send({
        message: 'Erro interno ao retomar atividade.'
      })
    }
  }
}
