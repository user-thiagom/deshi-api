import fastify from 'fastify'
import cors from '@fastify/cors'
import { userRoutes } from './modules/users/users.routes.js'
import { sessionRoutes } from './modules/sessions/sessions.routes.js'
import { modalidadeRoutes } from './modules/modalidades/modalidades.routes.js'
import { atividadeRoutes } from './modules/atividades/atividades.routes.js'
import { configuracaoAtividadeRoutes } from './modules/configuracoes-atividades/configuracoes-atividades.routes.js'
import { programRoutes } from './modules/programs/program.routes.js'
import { vinculoRoutes } from './modules/vinculos/vinculos.routes.js'
import { conviteRoutes } from './modules/vinculos/convite.routes.js'

const PORT = 3030

function isLocalFrontendOrigin(origin: string): boolean {
  const match = origin.match(/^http:\/\/([^:/]+):(\d+)$/)
  if (!match) return false

  const [, host, portValue] = match
  const port = Number(portValue)
  if (port < 5173 || port > 5180) return false
  if (host === 'localhost' || host === '127.0.0.1') return true

  const octets = host.split('.').map(Number)
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return false
  const [first, second] = octets

  return first === 10
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168)
}

const server = fastify()

await server.register(cors, {
  origin: (origin, callback) => {
    // Requisições sem Origin (por exemplo, health checks) não precisam de CORS.
    if (!origin || isLocalFrontendOrigin(origin)) return callback(null, true)
    return callback(new Error('Origem não permitida pelo CORS'), false)
  },
})

server.register(userRoutes)
server.register(sessionRoutes)
server.register(modalidadeRoutes)
server.register(atividadeRoutes)
server.register(configuracaoAtividadeRoutes)
server.register(programRoutes)
server.register(vinculoRoutes)
server.register(conviteRoutes)


server.get('/', async (request, reply) => {
  return 'API do DESHI funcionando!';
})

server.listen({ port: PORT, host: '0.0.0.0'}).then(()=>{
    console.log(`Servidor iniciado na porta ${PORT}`)
}).catch((error)=>{
    console.log(`Erro ao iniciar servidor: ${error}`)
})
