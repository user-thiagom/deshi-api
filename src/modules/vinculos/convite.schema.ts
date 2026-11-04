import { z } from 'zod'

export const criarConviteSchema = z.object({
    alunoId: z.uuid()
}).strict()

export const parametrosConviteSchema = z.object({
    codigo: z.string().regex(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/)
}).strict()

export type CriarConviteBody = z.infer<typeof criarConviteSchema>
export type ParametrosConvite = z.infer<typeof parametrosConviteSchema>
