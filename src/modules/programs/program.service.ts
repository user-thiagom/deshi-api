import { UserRepository } from '../users/repositories/user.repository.js'
import { ProgramResourceNotFoundError, StudentNotLinkedError } from './program.errors.js'
import { CreateProgramBody } from './program.schema.js'
import { ProgramCatalogRepository } from './repositories/program-catalog.repository.js'
import { ProgramRepository } from './repositories/program.repository.js'
import { Program } from './program.types.js'

export class ProgramService {
    constructor(
        private readonly programRepository: ProgramRepository,
        private readonly catalogRepository: ProgramCatalogRepository,
        private readonly userRepository: Pick<UserRepository, 'findById'>
    ) { }

    async createProgram(professionalId: string, data: CreateProgramBody): Promise<Program> {
        const link = await this.catalogRepository.findActiveStudentLink(
            professionalId,
            data.vinculoId
        )
        if (!link) {
            throw new StudentNotLinkedError()
        }

        if (!await this.catalogRepository.hasProfessionalModality(professionalId, data.modalityId)) {
            throw new ProgramResourceNotFoundError('Modalidade não encontrada ou não habilitada para este profissional.')
        }

        for (const item of data.activities) {
            const activity = await this.catalogRepository.findActivity(item.activityId)
            if (!activity || activity.modalidadeId !== data.modalityId ||
                (activity.origem === 'PERSONALIZADA' && activity.profissionalId !== professionalId)) {
                throw new ProgramResourceNotFoundError(`Atividade '${item.activityId}' não encontrada.`)
            }
        }

        return this.programRepository.create({
            professionalId,
            studentId: link.studentId,
            name: data.name,
            modalityId: data.modalityId,
            activities: [...data.activities].sort((left, right) => left.order - right.order)
        })
    }
}