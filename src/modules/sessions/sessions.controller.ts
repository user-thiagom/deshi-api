import { dataPath } from '../../config/data.js'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { PrismaAtividadeRepository, PrismaConfiguracaoRepository, PrismaModalidadeRepository, PrismaProgramCatalogRepository, PrismaProgramRepository, PrismaSessionRepository, PrismaUserRepository } from '../../shared/database/repositories.js'
import { SessionsService } from './sessions.service.js'
import {
    evolutionQuerySchema,
    recordActivityObservationSchema,
    startSessionSchema
} from './sessions.schema.js'
import { toSessionResult } from './sessions.mapper.js'
import {
    ProgramNotFoundError,
    ProgramNotOwnedByStudentError,
    SessionNotFoundError,
    SessionNotOwnedByProfessionalError,
    SessionNotOwnedByStudentError,
    SessionActivityNotFoundError,
    InvalidActivityStateError
} from './sessions.errors.js'

const programRepository = new PrismaProgramRepository()
const sessionRepository = new PrismaSessionRepository()
const configuracaoRepository = new PrismaConfiguracaoRepository()
const atividadeRepository = new PrismaAtividadeRepository()
const modalidadeRepository = new PrismaModalidadeRepository()
const userRepository = new PrismaUserRepository()

export const sessionsService = new SessionsService(
    programRepository,
    sessionRepository,
    configuracaoRepository,
    atividadeRepository,
    modalidadeRepository,
    new PrismaProgramCatalogRepository()
)

export function getProfessionalStudentEvolutionController(service: SessionsService) {
    return async function (
        request: FastifyRequest<{
            Params: { studentId: string }
            Querystring: { activityId?: string; metric?: string }
        }>,
        reply: FastifyReply
    ) {
        const query = evolutionQuerySchema.safeParse(request.query)

        if (!query.success) {
            return reply.code(400).send({
                message: 'Filtros inválidos.',
                errors: query.error.flatten()
            })
        }

        try {
            const evolution = await service.getProfessionalStudentEvolution(
                request.params.studentId,
                request.user.userId,
                query.data
            )

            return reply.code(200).send(evolution)
        } catch (error) {
            request.log.error(error)

            return reply.code(500).send({
                message: 'Erro interno ao consultar evolução do aluno.'
            })
        }
    }
}

export function getSessionResultController(service: SessionsService) {
    return async function (
        request: FastifyRequest<{ Params: { sessionId: string } }>,
        reply: FastifyReply
    ) {
        try {
            const session = await service.getSessionResult(
                request.params.sessionId,
                request.user.userId
            )

            const [student, program] = await Promise.all([
                userRepository.findById(session.studentId),
                programRepository.findById(session.programId)
            ])

            return reply.code(200).send({
                ...toSessionResult(session),
                studentName: student?.name ?? null,
                programName: program?.name ?? null
            })
        } catch (error) {
            if (error instanceof SessionNotFoundError) {
                return reply.code(404).send({
                    message: error.message
                })
            }

            if (error instanceof SessionNotOwnedByProfessionalError) {
                return reply.code(403).send({
                    message: error.message
                })
            }

            request.log.error(error)

            return reply.code(500).send({
                message: 'Erro interno ao consultar a sessão.'
            })
        }
    }
}

export function recordActivityObservationController(
    service: SessionsService
) {
    return async function (
        request: FastifyRequest<{
            Params: { sessionId: string; activityId: string }
        }>,
        reply: FastifyReply
    ) {
        const result = recordActivityObservationSchema.safeParse(request.body)

        if (!result.success) {
            return reply.code(400).send({
                message: 'Dados inválidos.',
                errors: result.error.flatten()
            })
        }

        try {
            const session = await service.recordActivityObservation(
                request.params.sessionId,
                request.user.userId,
                request.params.activityId,
                result.data.observation
            )

            return reply.code(200).send(session)
        } catch (error) {
            if (error instanceof SessionNotFoundError) {
                return reply.code(404).send({
                    message: error.message
                })
            }

            if (
                error instanceof SessionNotOwnedByStudentError ||
                error instanceof SessionActivityNotFoundError
            ) {
                return reply.code(403).send({
                    message: error.message
                })
            }

            if (error instanceof InvalidActivityStateError) {
                return reply.code(409).send({
                    message: error.message
                })
            }

            request.log.error(error)

            return reply.code(500).send({
                message: 'Erro interno ao registrar observação da atividade.'
            })
        }
    }
}

export async function startSessionController(
    request: FastifyRequest,
    reply: FastifyReply
) {
    const result = startSessionSchema.safeParse(request.body)

    if (!result.success) {
        return reply.code(400).send({
            message: 'Dados inválidos.',
            errors: result.error.flatten()
        })
    }

    try {
        const session = await sessionsService.startSession(
            result.data.programId,
            request.user.userId
        )

        return reply.code(201).send(session)
    } catch (error) {
        if (error instanceof ProgramNotFoundError) {
            return reply.code(404).send({
                message: error.message
            })
        }

        if (error instanceof ProgramNotOwnedByStudentError) {
            return reply.code(403).send({
                message: error.message
            })
        }

        request.log.error(error)

        return reply.code(500).send({
            message: 'Erro interno ao iniciar a sessão.'
        })
    }
}
