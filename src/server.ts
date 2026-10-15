import fastify from 'fastify'
import { userRoutes } from './modules/users/users.routes.js'
import { modalidadeRoutes } from './modules/modalidades/modalidades.routes.js'

const PORT = 3030

const server = fastify()

server.register(userRoutes)
server.register(modalidadeRoutes)

server.get('/', async (request, reply) => {
  return 'API do DESHI funcionando!';
})

server.listen({ port: PORT}).then(()=>{
    console.log(`Servidor iniciado na porta ${PORT}`)
}).catch((error)=>{
    console.log(`Erro ao iniciar servidor: ${error}`)
})
