import { z } from 'zod'

export const createUserSchema = z.object({
    name: z.string().min(3),
    email: z.email(),
    password: z.string().min(8),
    profile: z.enum(["PROFESSIONAL", "STUDENT"]),
    birthDate: z.iso.date().refine((value) => new Date(`${value}T00:00:00.000Z`) <= new Date(), 'A data de nascimento não pode estar no futuro.'),
    gender: z.enum(['MALE', 'FEMALE'])
})

export const loginSchema = z.object({
    email: z.email(),
    password: z.string().min(8),
})

export const studentBodyMetricsSchema = z.object({
    weightKg: z.number().min(1).max(500),
    heightCm: z.number().min(30).max(260)
}).strict()

export const updateStudentProfileSchema = z.object({
    name: z.string().trim().min(3).optional(),
    birthDate: z.iso.date().refine((value) => new Date(`${value}T00:00:00.000Z`) <= new Date(), 'A data de nascimento não pode estar no futuro.').optional(),
    gender: z.enum(['MALE', 'FEMALE']).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'Informe ao menos um dado para atualizar.')

export const changeStudentPasswordSchema = z.object({
    currentPassword: z.string().min(8),
    newPassword: z.string().min(8),
    confirmPassword: z.string().min(8),
}).strict().refine((value) => value.newPassword === value.confirmPassword, 'A nova senha e a confirmação não coincidem.')

export type CreateUserBody = z.infer<typeof createUserSchema>
export type LoginBody = z.infer<typeof loginSchema>
export type StudentBodyMetricsBody = z.infer<typeof studentBodyMetricsSchema>
export type UpdateStudentProfileBody = z.infer<typeof updateStudentProfileSchema>
export type ChangeStudentPasswordBody = z.infer<typeof changeStudentPasswordSchema>
