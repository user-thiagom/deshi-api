import { CatalogActivity } from '../program.types.js'

export interface ProgramCatalogRepository {
    isStudentLinkedToProfessional(professionalId: string, studentId: string): Promise<boolean>
    hasProfessionalModality(professionalId: string, modalityId: string): Promise<boolean>
    findActivity(activityId: string): Promise<CatalogActivity | null>
}