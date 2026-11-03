
import { FastifyReply, FastifyRequest } from 'fastify'
import { ProgramRepository } from './repositories/program.repository.js'

export function listProgramsController(
  programRepository: ProgramRepository
) {
  return async function (
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const programs = await programRepository.findByStudentId(
        request.user.userId
      )

      const orderedPrograms = programs.map((program) => ({
        ...program,
        activities: [...program.activities].sort(
          (a, b) => a.order - b.order
        )
      }))

      return reply.status(200).send(orderedPrograms)
    } catch (error) {
      request.log.error(error)

      return reply.status(500).send({
        message: 'Erro interno ao listar programas.'
      })
    }
  }
}
