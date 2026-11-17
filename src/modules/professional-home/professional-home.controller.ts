import type { FastifyReply, FastifyRequest } from 'fastify'
import type { ProfessionalHomeService } from './professional-home.service.js'

export function professionalHomeController(service: ProfessionalHomeService) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      return reply.code(200).send(await service.getDashboard(request.user.userId))
    } catch (error) {
      request.log.error(error)
      return reply.code(500).send({ message: 'Erro ao consultar o painel do profissional.' })
    }
  }
}
