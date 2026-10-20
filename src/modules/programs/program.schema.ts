import { z } from 'zod'

export const createProgramSchema = z.object({
    vinculoId: z.string().uuid(),
    name: z.string().trim().min(1),
    modalityId: z.string().uuid(),
    activities: z.array(z.object({
        activityId: z.string().uuid(),
        order: z.number().int().positive()
    }).strict()).min(1)
}).strict().superRefine((program, context) => {
    const seenActivityIds = new Set<string>()
    const seenOrders = new Set<number>()

    program.activities.forEach((activity, index) => {
        if (seenActivityIds.has(activity.activityId)) {
            context.addIssue({
                code: 'custom',
                path: ['activities', index, 'activityId'],
                message: 'Atividade duplicada.'
            })
        }
        if (seenOrders.has(activity.order)) {
            context.addIssue({
                code: 'custom',
                path: ['activities', index, 'order'],
                message: 'A ordem das atividades deve ser única.'
            })
        }
        seenActivityIds.add(activity.activityId)
        seenOrders.add(activity.order)
    })
})

export type CreateProgramBody = z.infer<typeof createProgramSchema>