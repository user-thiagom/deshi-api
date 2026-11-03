
import { FastifyInstance, preHandlerHookHandler } from 'fastify'
import { JsonUserRepository } from '../users/repositories/json-user.repository.js'
import { authenticate } from '../../shared/auth/authenticate.js'
import { authorizeProfile } from '../../shared/auth/authorize-profile.js'
import { createProgramController } from './program.controller.js'
import { listProgramsController } from './list-programs.controller.js'
import { JsonProgramCatalogRepository } from './repositories/json-program-catalog.repository.js'
import { JsonProgramRepository } from './repositories/json-program.repository.js'
import { ProgramService } from './program.service.js'

const programRepository = new JsonProgramRepository('data/programs.json')

const programService = new ProgramService(
  programRepository,
  new JsonProgramCatalogRepository(
    'data/vinculos.json',
    'data/modalidades.json',
    'data/profissional-modalidades.json',
    'data/atividades.json',
    'data/atividades-personalizadas.json'
  ),
  new JsonUserRepository('data/users.json')
)

export interface ProgramRouteDependencies {
  programService?: ProgramService
  authenticate?: preHandlerHookHandler
  authorizeProfessional?: preHandlerHookHandler
}

export async function programRoutes(
  server: FastifyInstance,
  dependencies: ProgramRouteDependencies = {}
) {
  server.post('/programs', {
    preHandler: [
      dependencies.authenticate ?? authenticate,
      dependencies.authorizeProfessional ?? authorizeProfile('PROFESSIONAL')
    ]
  }, createProgramController(dependencies.programService ?? programService))

  server.get('/programs', {
    preHandler: [
      dependencies.authenticate ?? authenticate,
      authorizeProfile('STUDENT')
    ]
  }, listProgramsController(programRepository))
}
