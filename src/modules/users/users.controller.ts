import { dataPath } from '../../config/data.js'
import { FastifyReply, FastifyRequest } from "fastify";
import { ChangeStudentPasswordBody, changeStudentPasswordSchema, CreateUserBody, createUserSchema, LoginBody, loginSchema, StudentBodyMetricsBody, studentBodyMetricsSchema, UpdateStudentProfileBody, updateStudentProfileSchema } from "./users.schema.js";
import { UserService } from "./users.service.js";
import { PrismaUserRepository, PrismaTokenRevocationRepository, PrismaVinculoRepository } from "../../shared/database/repositories.js";
import { EmailAlreadyExistsError, InvalidCredentialsError, InvalidCurrentPasswordError, ProfileFieldAlreadySetError, UserProfileNotFoundError } from "./users.errors.js";
import { toLoginResponse, toUserResponse } from "./users.mapper.js";
import { env } from "../../config/env.js";

const jsonUserRepository = new PrismaUserRepository()
const userService = new UserService(jsonUserRepository, env.jwtSecret)
const tokenRevocationRepository = new PrismaTokenRevocationRepository()
const vinculoRepository = new PrismaVinculoRepository()

export async function createUserController(request: FastifyRequest<{ Body: CreateUserBody }>, reply: FastifyReply) {
    const result = createUserSchema.safeParse(request.body)

    if (!result.success) {
        return reply.status(400).send("Formato de dados inválido!")
    }

    try {
        const userDataRes = await userService.createUser(result.data)
        return { ...toUserResponse(userDataRes), birthDate: userDataRes.birthDate?.toISOString().slice(0, 10) ?? null, gender: userDataRes.gender ?? null }
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

export async function getStudentBodyMetricsController(request: FastifyRequest, reply: FastifyReply) {
    const metrics = await jsonUserRepository.findBodyMetricsByStudentId(request.user.userId)
    return reply.status(200).send(metrics)
}

export async function getProfessionalStudentBodyMetricsController(
    request: FastifyRequest<{ Params: { studentId: string } }>,
    reply: FastifyReply
) {
    const links = await vinculoRepository.buscarEntreProfissionalEAluno(request.user.userId, request.params.studentId)
    if (!links.some((link) => link.status === 'ATIVO')) {
        return reply.status(404).send({ message: 'Aluno não encontrado ou sem vínculo ativo.' })
    }

    const metrics = await jsonUserRepository.findBodyMetricsByStudentId(request.params.studentId)
    if (!metrics) return reply.status(200).send(null)
    return reply.status(200).send({
        weightKg: metrics.weightKg,
        heightCm: metrics.heightCm,
        bmi: metrics.bmi,
        birthDate: metrics.birthDate?.toISOString().slice(0, 10) ?? null,
        gender: metrics.gender ?? null,
        updatedAt: metrics.updatedAt,
        history: metrics.history.map(({ id, weightKg, recordedAt }) => ({ id, weightKg, recordedAt })),
    })
}

export async function updateStudentBodyMetricsController(request: FastifyRequest<{ Body: StudentBodyMetricsBody }>, reply: FastifyReply) {
    const result = studentBodyMetricsSchema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ message: 'Informe peso e altura dentro dos limites permitidos.' })

    const metrics = await jsonUserRepository.updateBodyMetricsByStudentId(request.user.userId, result.data)
    if (!metrics) return reply.status(404).send({ message: 'Perfil de aluno não encontrado.' })
    return reply.status(200).send(metrics)
}

export async function updateStudentProfileController(request: FastifyRequest<{ Body: UpdateStudentProfileBody }>, reply: FastifyReply) {
    const result = updateStudentProfileSchema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ message: result.error.issues[0]?.message ?? 'Informe os dados válidos para atualizar.' })
    try {
        const user = await userService.updateStudentProfile(request.user.userId, result.data)
        return reply.status(200).send({
            id: user.id,
            name: user.name,
            email: user.email,
            profile: user.profile,
            birthDate: user.birthDate?.toISOString().slice(0, 10) ?? null,
            gender: user.gender ?? null,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        })
    } catch (error) {
        if (error instanceof UserProfileNotFoundError) return reply.status(404).send({ message: error.message })
        if (error instanceof ProfileFieldAlreadySetError) return reply.status(409).send({ message: error.message })
        throw error
    }
}

export async function changeStudentPasswordController(request: FastifyRequest<{ Body: ChangeStudentPasswordBody }>, reply: FastifyReply) {
    const result = changeStudentPasswordSchema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ message: result.error.issues[0]?.message ?? 'Confira os dados da senha.' })
    try {
        await userService.changeStudentPassword(request.user.userId, result.data.currentPassword, result.data.newPassword)
        return reply.status(204).send()
    } catch (error) {
        if (error instanceof UserProfileNotFoundError) return reply.status(404).send({ message: error.message })
        if (error instanceof InvalidCurrentPasswordError) return reply.status(401).send({ message: error.message })
        throw error
    }
}
