import { z } from 'zod'

export const createProgramSchema = z.object({
    studentId: z.string().uuid(),
    name: z.string().trim().min(1),
    modalityId: z.string().uuid(),
    activityIds: z.array(z.string().uuid()).min(1)
})

export type CreateProgramBody = z.infer<typeof createProgramSchema>