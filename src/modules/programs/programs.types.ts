export type ProgramActivity = {
    activityId: string
    order: number
}

export type Program = {
    id: string
    name: string
    studentId: string
    professionalId: string
    activities: ProgramActivity[]
}