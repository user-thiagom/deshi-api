import { z } from 'zod'

export const startSessionSchema = z.object({
    programId: z.string().trim().min(1, 'programId é obrigatório')
})

export const recordActivityObservationSchema = z.object({
    observation: z.string().trim().min(1, 'A observação não pode estar vazia.')
}).strict()

export type StartSessionBody = z.infer<typeof startSessionSchema>
export type RecordActivityObservationBody = z.infer<
    typeof recordActivityObservationSchema
>