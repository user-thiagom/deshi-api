import { FastifyReply, FastifyRequest } from "fastify";
import { CreateUserBody, createUserSchema } from "./users.schema.js";
import { UserService } from "./users.service.js";
import { JsonUserRepository } from "./repositories/json-user.repository.js";

const jsonUserRepository = new JsonUserRepository()
const userService = new UserService(jsonUserRepository)

export async function createUserController(request: FastifyRequest<{ Body: CreateUserBody }>, reply: FastifyReply) {
    const result = createUserSchema.safeParse(request.body)

    if(!result.success){
        return reply.status(400).send("Formato de dados inválido!")
    }

    const userDataRes = await userService.createUser(result.data)

    return userDataRes
}