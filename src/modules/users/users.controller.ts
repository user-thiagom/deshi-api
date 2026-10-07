import { FastifyReply, FastifyRequest } from "fastify";
import { createUserService } from "./users.service.js";
import { CreateUserBody, createUserSchema } from "./users.schema.js";

export async function createUserController(request: FastifyRequest<{ Body: CreateUserBody }>, reply: FastifyReply) {
    const result = createUserSchema.safeParse(request.body)

    if(!result.success){
        return reply.status(400).send("Formato de dados inválido!")
    }

    const userDataRes = await createUserService(result.data)

    return userDataRes
}