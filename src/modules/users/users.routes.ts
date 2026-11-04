import { FastifyInstance } from 'fastify'
import { createUserController, loginController, logoutController } from './users.controller.js'
import { authenticate } from '../../shared/auth/authenticate.js'
import { authorizeProfile } from '../../shared/auth/authorize-profile.js'

export async function userRoutes(server: FastifyInstance) {
    server.post('/users', createUserController)
    server.post('/login', loginController)
    server.post('/logout', { preHandler: authenticate }, logoutController)

    //ROTAS DE TESTES DE AUTENTICAÇÃO E AUTORIZAÇÃO
    server.get('/professional-test',{ preHandler: [authenticate, authorizeProfile('PROFESSIONAL')]},
        async () => {
            return { message: 'Acesso profissional autorizado!' }
        }
    )
    server.get('/student-test',{ preHandler: [authenticate, authorizeProfile('STUDENT')]},
        async () => {
            return { message: 'Acesso estudante autorizado!' }
        }
    )
}