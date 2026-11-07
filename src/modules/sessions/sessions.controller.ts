import type { FastifyReply, FastifyRequest } from 'fastify'
import path from 'node:path'

import { JsonProgramRepository } from '../programs/repositories/json-program.repository.js'
import { JsonSessionRepository } from './repositories/json-session.repository.js'
import { JsonConfiguracaoRepository } from '../configuracoes-atividades/repositories/json-configuracao.repository.js'
import { JsonAtividadeRepository } from '../atividades/repositories/json-atividade.repository.js'
import { JsonModalidadeRepository } from '../modalidades/repositories/json-modalidade.repository.js'
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

const programRepository = new JsonProgramRepository(
    path.resolve(process.cwd(), 'data', 'programs.json')
)

const sessionRepository = new JsonSessionRepository(
    path.resolve(process.cwd(), 'data', 'sessions.json')
)

const configuracaoRepository = new JsonConfiguracaoRepository(
    path.resolve(process.cwd(), 'data', 'configuracoes-atividades.json')
)

const atividadeRepository = new JsonAtividadeRepository(
    path.resolve(process.cwd(), 'data', 'atividades.json'),
    path.resolve(process.cwd(), 'data', 'atividades-personalizadas.json')
)

const modalidadeRepository = new JsonModalidadeRepository(
    path.resolve(process.cwd(), 'data', 'modalidades.json'),
    path.resolve(process.cwd(), 'data', 'profissional-modalidades.json')
)

export const sessionsService = new SessionsService(
    programRepository,
    sessionRepository,
    configuracaoRepository,
    atividadeRepository,
    modalidadeRepository
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

            return reply.code(200).send(toSessionResult(session))
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