import 'fastify'

declare module 'fastify' {
    interface FastifyRequest {
        user: {
            userId: string
            jti: string
            exp: number
        }
    }
}

//É basicamente um declaração para o typescript saber que apropriedade request.user existe. Não cria
//em tempo de execução o authenticate.ts é responsável por preencher antes de passar pro controller.