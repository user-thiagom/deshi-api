import { z } from 'zod'

export const createUserSchema = z.object({
    name: z.string().min(3),
    email: z.email(),
    password: z.string().min(8),
    profile: z.enum(["PROFESSIONAL", "STUDENT"])
})

export const loginSchema = z.object({
    email: z.email(),
    password: z.string().min(8),
})

export const studentBodyMetricsSchema = z.object({
    weightKg: z.number().min(1).max(500),
    heightCm: z.number().min(30).max(260)
}).strict()

export type CreateUserBody = z.infer<typeof createUserSchema>
export type LoginBody = z.infer<typeof loginSchema>
export type StudentBodyMetricsBody = z.infer<typeof studentBodyMetricsSchema>
