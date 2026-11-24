import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
    JWT_SECRET: z.string().min(1),
    DATABASE_URL: z.string().url().default('postgresql://postgres:postgres@localhost:5432/deshi'),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
})

const result = envSchema.safeParse(process.env)

if (!result.success) {
    throw new Error("Erro de variável de ambiente")
}

export const env = {
    jwtSecret: result.data.JWT_SECRET,
    databaseUrl: result.data.DATABASE_URL,
    nodeEnv: result.data.NODE_ENV
}
