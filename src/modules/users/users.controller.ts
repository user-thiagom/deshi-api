import { FastifyReply, FastifyRequest } from "fastify";
import { CreateUserBody, createUserSchema, LoginBody, loginSchema } from "./users.schema.js";
import { UserService } from "./users.service.js";
import { PrismaUserRepository, PrismaTokenRevocationRepository } from "../../shared/database/repositories.js";
import { EmailAlreadyExistsError, InvalidCredentialsError } from "./users.errors.js";
import { toLoginResponse, toUserResponse } from "./users.mapper.js";
import { env } from "../../config/env.js";

const jsonUserRepository = new PrismaUserRepository()
const userService = new UserService(jsonUserRepository, env.jwtSecret)
const tokenRevocationRepository = new PrismaTokenRevocationRepository()

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

export async function logoutController(request: FastifyRequest, reply: FastifyReply) {
    const { jti, exp } = request.user

    await tokenRevocationRepository.revoke(
        jti,
        new Date(exp * 1000)
    )

    return reply.status(204).send()
}
