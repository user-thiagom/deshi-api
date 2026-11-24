import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../shared/auth/authenticate.js'
import { authorizeProfile } from '../../shared/auth/authorize-profile.js'
import { PrismaAtividadeRepository, PrismaProgramRepository, PrismaSessionRepository, PrismaUserRepository, PrismaVinculoRepository } from '../../shared/database/repositories.js'
import { professionalHomeController } from './professional-home.controller.js'
import { ProfessionalHomeService } from './professional-home.service.js'

const service = new ProfessionalHomeService(
  new PrismaUserRepository(),
  new PrismaVinculoRepository(),
  new PrismaProgramRepository(),
  new PrismaSessionRepository(),
  new PrismaAtividadeRepository()
)

export async function professionalHomeRoutes(server: FastifyInstance) {
  server.get('/professional/home', {
    preHandler: [authenticate, authorizeProfile('PROFESSIONAL')]
  }, professionalHomeController(service))
}
