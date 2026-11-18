import type { FastifyReply, FastifyRequest } from 'fastify'
import type { SessionsService } from './sessions.service.js'
import {
  InvalidActivityStateError,
  SessionNotFoundError,
  SessionNotOwnedByStudentError,
} from './sessions.errors.js'

type SessionAction = 'pauseSession' | 'resumeSession'

function createSessionActionController(service: SessionsService, action: SessionAction) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const { sessionId } = request.params as { sessionId: string }

    try {
      const session = await service[action](sessionId, request.user.userId)
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
      return reply.status(500).send({
        message: action === 'pauseSession'
          ? 'Erro interno ao pausar sessão.'
          : 'Erro interno ao retomar sessão.',
      })
    }
  }
}

export function pauseSessionController(service: SessionsService) {
  return createSessionActionController(service, 'pauseSession')
}

export function resumeSessionController(service: SessionsService) {
  return createSessionActionController(service, 'resumeSession')
}
