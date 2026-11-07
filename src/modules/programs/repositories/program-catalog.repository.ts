import type { CamposAtividade } from '../../configuracoes-atividades/configuracoes-atividades.types.js'
import type { CatalogActivity } from '../program.types.js'

export interface ProgramCatalogRepository {
    isStudentLinkedToProfessional(professionalId: string, studentId: string): Promise<boolean>
    hasProfessionalModality(professionalId: string, modalityId: string): Promise<boolean>
    findActivity(activityId: string): Promise<CatalogActivity | null>
    findActivityFields?(activityId: string): Promise<CamposAtividade | null>
}
