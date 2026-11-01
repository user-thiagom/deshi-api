import fastify from 'fastify'
import cors from '@fastify/cors'
import { userRoutes } from './modules/users/users.routes.js'
import { vinculoRoutes } from './modules/vinculos/vinculos.routes.js'
import { modalidadeRoutes } from './modules/modalidades/modalidades.routes.js'
import { atividadeRoutes } from './modules/atividades/atividades.routes.js'
import { configuracaoAtividadeRoutes } from './modules/configuracoes-atividades/configuracoes-atividades.routes.js'
import { programaRoutes } from './modules/programas/programas.routes.js'

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
server.register(vinculoRoutes)
server.register(modalidadeRoutes)
server.register(atividadeRoutes)
server.register(configuracaoAtividadeRoutes)
server.register(programaRoutes)

server.get('/', async (request, reply) => {
  return 'API do DESHI funcionando!';
})

server.listen({ port: PORT, host: '0.0.0.0'}).then(()=>{
    console.log(`Servidor iniciado na porta ${PORT}`)
}).catch((error)=>{
    console.log(`Erro ao iniciar servidor: ${error}`)
})
