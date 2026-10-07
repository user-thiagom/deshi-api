import { z } from 'zod'

export const createUserSchema = z.object({
    name: z.string().min(3),
    email: z.email(),
    password: z.string().min(8),
    profile: z.enum(["PROFESSIONAL", "STUDENT"])
})

export type CreateUserBody = z.infer<typeof createUserSchema>