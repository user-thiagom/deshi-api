import { z } from 'zod'

export const definirModalidadesSchema = z.object({
    modalidadeIds: z.array(z.uuid()).min(1).refine(
        (ids) => new Set(ids).size === ids.length,
        'Não é permitido repetir modalidades.'
    )
}).strict()

export type DefinirModalidadesBody = z.infer<typeof definirModalidadesSchema>
