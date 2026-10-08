import { FastifyReply, FastifyRequest } from "fastify";
import { CreateUserBody, createUserSchema, LoginBody, loginSchema } from "./users.schema.js";
import { UserService } from "./users.service.js";
import { JsonUserRepository } from "./repositories/json-user.repository.js";
import { EmailAlreadyExistsError, InvalidCredentialsError } from "./users.errors.js";
import { toLoginResponse, toUserResponse } from "./users.mapper.js";
import { env } from "../../config/env.js";

const jsonUserRepository = new JsonUserRepository("data/users.json")
const userService = new UserService(jsonUserRepository, env.jwtSecret)

export async function createUserController(request: FastifyRequest<{ Body: CreateUserBody }>, reply: FastifyReply) {
    const result = createUserSchema.safeParse(request.body)

    if (!result.success) {
        return reply.status(400).send("Formato de dados inválido!")
    }

    try {
        const userDataRes = await userService.createUser(result.data)
        return toUserResponse(userDataRes)
    } catch (error) {
        if (error instanceof EmailAlreadyExistsError)
            return reply.status(409).send(error.message)
        throw error
    }
}

export async function loginController(request: FastifyRequest<{ Body: LoginBody }>, reply: FastifyReply) {
    const result = loginSchema.safeParse(request.body)

    if (!result.success) {
        return reply.status(400).send("Formato de dados inválido!")
    }

    try {
        const loginResult = await userService.login(result.data)
        return toLoginResponse(loginResult.user, loginResult.token)
    } catch (error) {
        if (error instanceof InvalidCredentialsError)
            return reply.status(401).send(error.message)
        throw error
    }
}