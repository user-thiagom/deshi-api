import { z } from 'zod'

export const listarAtividadesSchema = z.object({
    busca: z.string().trim().optional(),
    modalidadeId: z.uuid().optional()
}).strict()

export const criarAtividadeSchema = z.object({
    nome: z.string().trim().min(1),
    descricao: z.string().trim().optional(),
    midiaUrl: z.url({ protocol: /^https?$/ }).optional(),
    modalidadeId: z.uuid()
}).strict()

export type ListarAtividadesQuery = z.infer<typeof listarAtividadesSchema>
export type CriarAtividadeBody = z.infer<typeof criarAtividadeSchema>
