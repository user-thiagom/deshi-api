import fastify from 'fastify'
import { userRoutes } from './modules/users/users.routes.js'
<<<<<<< HEAD
import { sessionRoutes } from './modules/sessions/sessions.routes.js'
import { modalidadeRoutes } from './modules/modalidades/modalidades.routes.js'
import { atividadeRoutes } from './modules/atividades/atividades.routes.js'
import { configuracaoAtividadeRoutes } from './modules/configuracoes-atividades/configuracoes-atividades.routes.js'
>>>>>>> origin/US_09--Configurar-atividade
=======
import { programRoutes } from './modules/programs/program.routes.js'
>>>>>>> origin/US_10---Criar-programa

const PORT = 3030

const server = fastify()

server.register(userRoutes)
<<<<<<< HEAD
<<<<<<< HEAD
server.register(sessionRoutes)
=======
server.register(modalidadeRoutes)
server.register(atividadeRoutes)
server.register(configuracaoAtividadeRoutes)
>>>>>>> origin/US_09--Configurar-atividade
=======
server.register(programRoutes)
>>>>>>> origin/US_10---Criar-programa

server.get('/', async (request, reply) => {
  return 'API do DESHI funcionando!';
})

server.listen({ port: PORT}).then(()=>{
    console.log(`Servidor iniciado na porta ${PORT}`)
}).catch((error)=>{
    console.log(`Erro ao iniciar servidor: ${error}`)
})
