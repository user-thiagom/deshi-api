import { z } from 'zod'

export const registerExecutionSchema = z.object({
  sessionId: z.string().trim().min(1, 'Sessão obrigatória.'),
  activityId: z.string().trim().min(1, 'Atividade obrigatória.'),
  values: z.record(z.string(), z.number()),
  status: z.enum(['COMPLETED', 'INCOMPLETE'])
})

export type RegisterExecutionBody = z.infer<
  typeof registerExecutionSchema
>
