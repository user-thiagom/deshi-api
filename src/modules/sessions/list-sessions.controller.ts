import type { FastifyReply, FastifyRequest } from 'fastify'

import { sessionsService } from './sessions.controller.js'

export async function listSessionsController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const sessions = await sessionsService.getStudentSessions(
      request.user.userId
    )

    return reply.status(200).send(sessions)
  } catch (error) {
    request.log.error(error)

    return reply.status(500).send({
      message: 'Erro interno ao consultar histórico de sessões.'
    })
  }
}