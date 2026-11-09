import { FastifyReply, FastifyRequest } from "fastify";
import { CreateUserBody, createUserSchema } from "./users.schema.js";
import { UserService } from "./users.service.js";
import { JsonUserRepository } from "./repositories/json-user.repository.js";
import { EmailAlreadyExistsError } from "./users.errors.js";
import { toUserResponse } from "./users.mapper.js";

const jsonUserRepository = new JsonUserRepository("data/users.json")
const userService = new UserService(jsonUserRepository)

export async function createUserController(request: FastifyRequest<{ Body: CreateUserBody }>, reply: FastifyReply) {
    const result = createUserSchema.safeParse(request.body)

    if(!result.success){
        return reply.status(400).send("Formato de dados inválido!")
    }

    try {
        const userDataRes = await userService.createUser(result.data)
        return toUserResponse(userDataRes)
    } catch (error) {
        if(error instanceof EmailAlreadyExistsError)
            reply.status(409).send(error.message)
        throw error
    }
}