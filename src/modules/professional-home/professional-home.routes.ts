import path from 'node:path'
import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../shared/auth/authenticate.js'
import { authorizeProfile } from '../../shared/auth/authorize-profile.js'
import { JsonProgramRepository } from '../programs/repositories/json-program.repository.js'
import { JsonSessionRepository } from '../sessions/repositories/json-session.repository.js'
import { JsonUserRepository } from '../users/repositories/json-user.repository.js'
import { JsonAtividadeRepository } from '../atividades/repositories/json-atividade.repository.js'
import { JsonVinculoRepository } from '../vinculos/repositories/json-vinculo.repository.js'
import { professionalHomeController } from './professional-home.controller.js'
import { ProfessionalHomeService } from './professional-home.service.js'

const dataPath = (...parts: string[]) => path.resolve(process.cwd(), 'data', ...parts)
const service = new ProfessionalHomeService(
  new JsonUserRepository(dataPath('users.json')),
  new JsonVinculoRepository(dataPath('vinculos.json')),
  new JsonProgramRepository(dataPath('programs.json')),
  new JsonSessionRepository(dataPath('sessions.json')),
  new JsonAtividadeRepository(dataPath('atividades.json'), dataPath('atividades-personalizadas.json'))
)

export async function professionalHomeRoutes(server: FastifyInstance) {
  server.get('/professional/home', {
    preHandler: [authenticate, authorizeProfile('PROFESSIONAL')]
  }, professionalHomeController(service))
}
