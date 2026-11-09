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

export type CreateUserBody = z.infer<typeof createUserSchema>
export type LoginBody = z.infer<typeof loginSchema>