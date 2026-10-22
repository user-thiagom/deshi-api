import fastify from 'fastify'
import cors from '@fastify/cors'
import { userRoutes } from './modules/users/users.routes.js'

const PORT = 3030

const server = fastify()

await server.register(cors, {
  origin: [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://192.168.4.2:5173',
  ],
})

server.register(userRoutes)

server.get('/', async (request, reply) => {
  return 'API do DESHI funcionando!';
})

server.listen({ port: PORT, host: '0.0.0.0'}).then(()=>{
    console.log(`Servidor iniciado na porta ${PORT}`)
}).catch((error)=>{
    console.log(`Erro ao iniciar servidor: ${error}`)
})
