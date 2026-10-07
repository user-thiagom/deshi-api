import { FastifyRequest } from "fastify";
import { CreateUserBody } from "./users.types.js";

export async function createUserController(request: FastifyRequest<{Body: CreateUserBody}>) {
    const {name, email, password, profile} = request.body

    return {
        name,
        email,
        password,
        profile
    }
}