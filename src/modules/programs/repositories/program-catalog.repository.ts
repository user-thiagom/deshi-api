import { CatalogActivity } from '../program.types.js'

export interface ActiveStudentLink {
    studentId: string
}

export interface ProgramCatalogRepository {
    findActiveStudentLink(professionalId: string, linkId: string): Promise<ActiveStudentLink | null>
    hasProfessionalModality(professionalId: string, modalityId: string): Promise<boolean>
    findActivity(activityId: string): Promise<CatalogActivity | null>
}