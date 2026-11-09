import { z } from 'zod'

export const criarVinculoSchema = z.object({
    alunoId: z.uuid()
}).strict()

export const parametrosVinculoSchema = z.object({
    id: z.uuid()
})

export type CriarVinculoBody = z.infer<typeof criarVinculoSchema>
export type ParametrosVinculo = z.infer<typeof parametrosVinculoSchema>
