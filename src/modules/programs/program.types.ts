export interface Program {
    id: string
    professionalId: string
    studentId: string
    name: string
    modalityId: string
    activities: ProgramActivity[]
    version: number
    createdAt: Date
}

export type CreateProgramData = Omit<Program, 'id' | 'createdAt' | 'version'>

export interface ProgramActivity {
    activityId: string
    nome?: string
    midiaUrl?: string
    grupoMuscular?: string
    order: number
    prescribed?: Record<string, number>
}

export interface CatalogActivity {
    id: string
    nome?: string
    midiaUrl?: string
    grupoMuscular?: string
    modalidadeId: string
    origem: 'PADRAO' | 'PERSONALIZADA'
    profissionalId: string | null
}
