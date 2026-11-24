import { dataPath } from '../../config/data.js'
import { FastifyInstance, preHandlerHookHandler } from 'fastify'
import { authenticate } from '../../shared/auth/authenticate.js'
import { authorizeProfile } from '../../shared/auth/authorize-profile.js'
import {
    createProgramController,
    getProgramController,
    listProgramsController,
    updateProgramController
} from './program.controller.js'
import { PrismaUserRepository, PrismaProgramCatalogRepository, PrismaProgramRepository } from '../../shared/database/repositories.js'
import { ProgramService } from './program.service.js'

const programService = new ProgramService(
    new PrismaProgramRepository(),
    new PrismaProgramCatalogRepository(),
    new PrismaUserRepository()
)

export interface ProgramRouteDependencies {
    programService?: ProgramService
    authenticate?: preHandlerHookHandler
    authorizeProfessional?: preHandlerHookHandler
}

export async function programRoutes(server: FastifyInstance, dependencies: ProgramRouteDependencies = {}) {
    server.post('/programas', {
        preHandler: [
            dependencies.authenticate ?? authenticate,
            dependencies.authorizeProfessional ?? authorizeProfile('PROFESSIONAL')
        ]
    }, createProgramController(dependencies.programService ?? programService))

    server.get('/programas', {
        preHandler: [dependencies.authenticate ?? authenticate]
    }, listProgramsController(dependencies.programService ?? programService))

    server.get('/programas/:id', {
        preHandler: [dependencies.authenticate ?? authenticate]
    }, getProgramController(dependencies.programService ?? programService))

    server.put('/programas/:id', {
        preHandler: [
            dependencies.authenticate ?? authenticate,
            dependencies.authorizeProfessional ?? authorizeProfile('PROFESSIONAL')
        ]
    }, updateProgramController(dependencies.programService ?? programService))
}
