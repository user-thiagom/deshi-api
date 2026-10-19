import { FastifyReply, FastifyRequest } from 'fastify'
import { ProgramResourceNotFoundError, StudentNotLinkedError } from './program.errors.js'
import { createProgramSchema } from './program.schema.js'
import { ProgramService } from './program.service.js'

export function createProgramController(programService: ProgramService) {
    return async function (request: FastifyRequest, reply: FastifyReply) {
        const result = createProgramSchema.safeParse(request.body)
        if (!result.success) {
            return reply.status(400).send({ message: 'Formato de dados inválido!' })
        }

        try {
            const program = await programService.createProgram(request.user.userId, result.data)
            return reply.status(201).send(program)
        } catch (error) {
            if (error instanceof StudentNotLinkedError) {
                return reply.status(403).send({ message: error.message })
            }
            if (error instanceof ProgramResourceNotFoundError) {
                return reply.status(404).send({ message: error.message })
            }
            throw error
        }
    }
}