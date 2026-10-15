import { z } from 'zod'
import { ChaveMetrica, METRICAS } from './configuracoes-atividades.types.js'

export const idSchema = z.object({ id: z.uuid() }).strict()

const campoSchema = z.object({
    chave: z.enum(Object.keys(METRICAS) as [ChaveMetrica, ...ChaveMetrica[]]),
    tipo: z.enum(['inteiro', 'decimal', 'duracao']),
    obrigatorio: z.boolean(),
    unidade: z.string().optional(),
    min: z.number().optional(),
    max: z.number().optional()
}).strict().superRefine((campo, ctx) => {
    const metrica = METRICAS[campo.chave]
    const minimo = campo.min ?? metrica.min
    if (campo.tipo !== metrica.tipo ||
        (campo.unidade !== undefined && campo.unidade !== metrica.unidade)) {
        ctx.addIssue({ code: 'custom', message: 'Tipo ou unidade incompatível com a métrica.' })
    }
    if (minimo < metrica.min || (campo.max !== undefined && campo.max < minimo)) {
        ctx.addIssue({ code: 'custom', message: 'Limites inválidos para a métrica.' })
    }
    if (metrica.tipo !== 'decimal' &&
        (!Number.isSafeInteger(minimo) || (campo.max !== undefined && !Number.isSafeInteger(campo.max)))) {
        ctx.addIssue({ code: 'custom', message: 'Inteiros e durações exigem limites inteiros seguros.' })
    }
}).transform((campo) => ({
    ...campo,
    unidade: campo.unidade ?? METRICAS[campo.chave].unidade,
    min: campo.min ?? METRICAS[campo.chave].min
}))

export const definirCamposSchema = z.object({
    campos: z.array(campoSchema).min(1).max(Object.keys(METRICAS).length)
        .refine((campos) => new Set(campos.map((campo) => campo.chave)).size === campos.length,
            'Não é permitido repetir métricas.')
}).strict()

export const criarConfiguracaoSchema = z.object({
    valores: z.record(z.string(), z.number())
}).strict()

export type DefinirCamposBody = z.infer<typeof definirCamposSchema>
export type CriarConfiguracaoBody = z.infer<typeof criarConfiguracaoSchema>
export type IdParams = z.infer<typeof idSchema>
