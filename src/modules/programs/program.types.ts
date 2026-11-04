export interface Program {
    id: string
    professionalId: string
    studentId: string
    name: string
    modalityId: string
    activities: ProgramActivity[]
    createdAt: Date
}

export type CreateProgramData = Omit<Program, 'id' | 'createdAt'>

export interface ProgramActivity {
    activityId: string
    order: number
}

export interface CatalogActivity {
    id: string
    modalidadeId: string
    origem: 'PADRAO' | 'PERSONALIZADA'
    profissionalId: string | null
}