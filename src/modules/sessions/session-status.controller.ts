import type { FastifyReply, FastifyRequest } from 'fastify'
import { SessionNotFoundError, SessionNotOwnedByStudentError, InvalidActivityStateError } from './sessions.errors.js'
import type { SessionsService } from './sessions.service.js'

type SessionStatusAction = 'pauseSession' | 'resumeSession'

export function sessionStatusController(
  sessionsService: Pick<SessionsService, SessionStatusAction>,
  action: SessionStatusAction,
) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const { sessionId } = request.params as { sessionId: string }

    try {
      const session = await sessionsService[action](sessionId, request.user.userId)
      return reply.status(200).send(session)
    } catch (error) {
      if (error instanceof SessionNotFoundError) {
        return reply.status(404).send({ message: error.message })
      }
      if (error instanceof SessionNotOwnedByStudentError) {
        return reply.status(403).send({ message: error.message })
      }
      if (error instanceof InvalidActivityStateError) {
        return reply.status(409).send({ message: error.message })
      }

      request.log.error(error)
      return reply.status(500).send({ message: 'Erro interno ao atualizar a sessão.' })
    }
  }
}
