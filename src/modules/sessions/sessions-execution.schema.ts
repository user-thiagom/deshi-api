import { z } from 'zod'

export const registerExecutionSchema = z.object({
  sessionId: z.string().trim().min(1, 'Sessão obrigatória.'),
  activityId: z.string().trim().min(1, 'Atividade obrigatória.'),
  values: z.record(z.string(), z.number()),
  seriesNumber: z.number().int().positive().optional(),
  durationMs: z.number().nonnegative().optional(),
  restMs: z.number().nonnegative().optional(),
  comment: z.string().trim().max(2000).optional(),
  status: z.enum(['COMPLETED', 'INCOMPLETE', 'IN_PROGRESS'])
})

export type RegisterExecutionBody = z.infer<
  typeof registerExecutionSchema
>
