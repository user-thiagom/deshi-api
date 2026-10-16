import fastify from 'fastify'
import { userRoutes } from './modules/users/users.routes.js'
import { vinculoRoutes } from './modules/vinculos/vinculos.routes.js'
import { conviteRoutes } from './modules/vinculos/convite.routes.js'

const PORT = 3030

const server = fastify()

server.register(userRoutes)
server.register(vinculoRoutes)
server.register(conviteRoutes)

server.get('/', async (request, reply) => {
  return 'API do DESHI funcionando!';
})

server.listen({ port: PORT}).then(()=>{
    console.log(`Servidor iniciado na porta ${PORT}`)
}).catch((error)=>{
    console.log(`Erro ao iniciar servidor: ${error}`)
})
