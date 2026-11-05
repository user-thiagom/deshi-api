import { z } from 'zod'
import { criarConfiguracaoSchema } from '../configuracoes-atividades/configuracoes-atividades.schema.js'
import { METRICAS } from '../configuracoes-atividades/configuracoes-atividades.types.js'
import type { ChaveMetrica } from '../configuracoes-atividades/configuracoes-atividades.types.js'

function isMetricKey(key: string): key is ChaveMetrica {
    return Object.hasOwn(METRICAS, key)
}

const prescribedValuesSchema = criarConfiguracaoSchema.shape.valores
    .superRefine((values, context) => {
        for (const [key, value] of Object.entries(values)) {
            if (!Number.isFinite(value)) {
                context.addIssue({
                    code: 'custom',
                    path: [key],
                    message: 'O valor deve ser finito.'
                })
                continue
            }

            if (!isMetricKey(key)) {
                context.addIssue({
                    code: 'custom',
                    path: [key],
                    message: 'Métrica não permitida.'
                })
                continue
            }

            const metric = METRICAS[key]
            if (
                value < metric.min ||
                (metric.tipo !== 'decimal' && !Number.isSafeInteger(value))
            ) {
                context.addIssue({
                    code: 'custom',
                    path: [key],
                    message: 'Valor inválido para a métrica.'
                })
            }
        }
    })

const programActivitySchema = z.object({
    atividadeId: z.string().uuid(),
    ordem: z.number().int().positive(),
    valores: prescribedValuesSchema
}).strict().transform(({ atividadeId, ordem, valores }) => ({
    activityId: atividadeId,
    order: ordem,
    prescribed: valores
}))

const programActivitiesSchema = z.array(
    z.union([z.string().uuid(), programActivitySchema])
).min(1).transform((activities) => activities.map((activity, index) =>
    typeof activity === 'string'
        ? { activityId: activity, order: index + 1, prescribed: undefined }
        : activity
)).superRefine((activities, context) => {
    const activityIds = new Set<string>()
    const orders = new Set<number>()

    activities.forEach((activity, index) => {
        if (activityIds.has(activity.activityId)) {
            context.addIssue({
                code: 'custom',
                path: [index, 'activityId'],
                message: 'A atividade não pode ser repetida.'
            })
        }
        activityIds.add(activity.activityId)

        if (orders.has(activity.order)) {
            context.addIssue({
                code: 'custom',
                path: [index, 'order'],
                message: 'A ordem das atividades não pode ser repetida.'
            })
        }
        orders.add(activity.order)
    })
})

export const programDataSchema = z.object({
    alunoId: z.string().uuid(),
    nome: z.string().trim().min(1),
    modalidadeId: z.string().uuid(),
    atividades: programActivitiesSchema
}).strict().transform(({ alunoId, nome, modalidadeId, atividades }) => ({
    studentId: alunoId,
    name: nome,
    modalityId: modalidadeId,
    activityIds: atividades.map(({ activityId }) => activityId),
    activities: atividades
}))

export const createProgramSchema = programDataSchema
export const updateProgramSchema = programDataSchema
export const programIdParamsSchema = z.object({ id: z.uuid() }).strict()

export type CreateProgramBody = z.infer<typeof createProgramSchema>
export type UpdateProgramBody = z.infer<typeof updateProgramSchema>
