import { z } from 'zod'

export const startSessionSchema = z.object({
    programId: z.string().trim().min(1, 'programId é obrigatório')
})

export type StartSessionBody = z.infer<typeof startSessionSchema>