import type { FastifyReply, FastifyRequest } from 'fastify'

import type { SessionsService } from './sessions.service.js'

export function listProfessionalSessionsController(service: SessionsService) {
  return async function (
    request: FastifyRequest<{ Params: { studentId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const sessions = await service.getProfessionalStudentSessions(
        request.params.studentId,
        request.user.userId
      )

      return reply.code(200).send(sessions)
    } catch (error) {
      request.log.error(error)

      return reply.code(500).send({
        message: 'Erro interno ao consultar histórico de sessões.'
      })
    }
  }
}
