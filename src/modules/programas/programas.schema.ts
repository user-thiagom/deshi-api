
import { z } from 'zod'

const atividadeDoProgramaSchema = z.object({
    atividadeId: z.uuid(),
    ordem: z.number().int().min(1),
    valores: z.record(z.string(), z.number()).default({})
}).strict()

const dadosProgramaSchema = z.object({
    alunoId: z.uuid(),
    modalidadeId: z.uuid(),
    nome: z.string().trim().min(1).max(100),
    atividades: z.array(atividadeDoProgramaSchema).min(1)
}).strict().superRefine((programa, ctx) => {
    const ordens = programa.atividades.map((atividade) => atividade.ordem)

    if (new Set(ordens).size !== ordens.length) {
        ctx.addIssue({
            code: 'custom',
            path: ['atividades'],
            message: 'A ordem das atividades não pode se repetir.'
        })
    }

    const ids = programa.atividades.map((atividade) => atividade.atividadeId)

    if (new Set(ids).size !== ids.length) {
        ctx.addIssue({
            code: 'custom',
            path: ['atividades'],
            message: 'Uma atividade não pode aparecer mais de uma vez.'
        })
    }
})

export const criarProgramaSchema = dadosProgramaSchema
export const editarProgramaSchema = dadosProgramaSchema

export type CriarProgramaBody = z.infer<typeof criarProgramaSchema>
export type EditarProgramaBody = z.infer<typeof editarProgramaSchema>
