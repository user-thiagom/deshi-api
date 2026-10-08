import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
    JWT_SECRET: z.string().min(1),
})

const result = envSchema.safeParse(process.env)

if (!result.success) {
    throw new Error("Erro de variável de ambiente")
}

export const env = {
    jwtSecret: result.data.JWT_SECRET
}