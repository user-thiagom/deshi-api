import { FastifyReply, FastifyRequest } from 'fastify'
import { ConfiguracaoError } from '../configuracoes-atividades/configuracoes-atividades.errors.js'
import {
    ProgramAccessDeniedError,
    InvalidProgramDataError,
    ProgramNotOwnedError,
    ProgramResourceNotFoundError,
    StudentNotLinkedError
} from './program.errors.js'
import {
    createProgramSchema,
    programIdParamsSchema,
    updateProgramSchema
} from './program.schema.js'
import { ProgramService } from './program.service.js'
import type { Program } from './program.types.js'

function toProgramResponse(
    program: Program,
    professional?: { id: string; name: string } | null
) {
    const {
        studentId,
        name,
        modalityId,
        activities,
        professionalId,
        createdAt,
        ...programData
    } = program

    return {
        ...programData,
        profissionalId: professionalId,
        alunoId: studentId,
        nome: name,
        modalidadeId: modalityId,
        criadoEm: createdAt,
        ...(professional === undefined ? {} : { profissional: professional }),
        atividades: activities.map((activity) => ({
            atividadeId: activity.activityId,
            ordem: activity.order,
            ...(activity.prescribed === undefined
                ? {}
                : { valores: { ...activity.prescribed } })
        }))
    }
}

function sendProgramError(error: unknown, reply: FastifyReply) {
    if (error instanceof StudentNotLinkedError ||
        error instanceof ProgramNotOwnedError ||
        error instanceof ProgramAccessDeniedError) {
        return reply.status(403).send({ message: error.message })
    }
    if (error instanceof ProgramResourceNotFoundError) {
        return reply.status(404).send({ message: error.message })
    }
    if (error instanceof InvalidProgramDataError) {
        return reply.status(400).send({ message: error.message })
    }
    if (error instanceof ConfiguracaoError) {
        return reply.status(error.statusCode).send({ message: error.message })
    }
    return null
}

export function createProgramController(programService: ProgramService) {
    return async function (request: FastifyRequest, reply: FastifyReply) {
        const result = createProgramSchema.safeParse(request.body)
        if (!result.success) {
            return reply.status(400).send({ message: 'Formato de dados inválido!' })
        }

        try {
            const program = await programService.createProgram(request.user.userId, result.data)
            return reply.status(201).send(toProgramResponse(program))
        } catch (error) {
            const handled = sendProgramError(error, reply)
            if (handled) return handled
            throw error
        }
    }
}

export function listProgramsController(programService: ProgramService) {
    return async function (request: FastifyRequest, reply: FastifyReply) {
        try {
            const programs = await programService.findProgramsForUser(request.user.userId)
            return reply.status(200).send(
                programs.map(({ program, professional }) =>
                    toProgramResponse(program, professional)
                )
            )
        } catch (error) {
            const handled = sendProgramError(error, reply)
            if (handled) return handled
            request.log.error(error)
            return reply.status(500).send({
                message: 'Erro interno ao consultar programas.'
            })
        }
    }
}

export function getProgramController(programService: ProgramService) {
    return async function (request: FastifyRequest, reply: FastifyReply) {
        const params = programIdParamsSchema.safeParse(request.params)
        if (!params.success) {
            return reply.status(400).send({ message: 'Parâmetros inválidos.' })
        }

        try {
            const { program, professional } = await programService.findProgramForUser(
                request.user.userId,
                params.data.id
            )
            return reply.status(200).send(toProgramResponse(program, professional))
        } catch (error) {
            const handled = sendProgramError(error, reply)
            if (handled) return handled
            request.log.error(error)
            return reply.status(500).send({
                message: 'Erro interno ao consultar programa.'
            })
        }
    }
}

export function updateProgramController(programService: ProgramService) {
    return async function (request: FastifyRequest, reply: FastifyReply) {
        const params = programIdParamsSchema.safeParse(request.params)
        const body = updateProgramSchema.safeParse(request.body)
        if (!params.success || !body.success) {
            return reply.status(400).send({ message: 'Formato de dados inválido!' })
        }

        try {
            const program = await programService.updateProgram(
                request.user.userId,
                params.data.id,
                body.data
            )
            return reply.status(200).send(toProgramResponse(program))
        } catch (error) {
            const handled = sendProgramError(error, reply)
            if (handled) return handled
            request.log.error(error)
            return reply.status(500).send({
                message: 'Erro interno ao atualizar programa.'
            })
        }
    }
}