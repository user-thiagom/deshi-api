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
        const student = await this.userRepository.findById(data.studentId)
        if (!student || student.profile !== 'STUDENT') {
            throw new ProgramResourceNotFoundError('Aluno não encontrado.')
        }

        const isLinked = await this.catalogRepository.isStudentLinkedToProfessional(
            professionalId,
            data.studentId
        )
        if (!isLinked) {
            throw new StudentNotLinkedError()
        }

        if (!await this.catalogRepository.hasProfessionalModality(professionalId, data.modalityId)) {
            throw new ProgramResourceNotFoundError('Modalidade não encontrada ou não habilitada para este profissional.')
        }

        const activities = []
        for (const [index, activityId] of data.activityIds.entries()) {
            const activity = await this.catalogRepository.findActivity(activityId)
            if (!activity || activity.modalidadeId !== data.modalityId ||
                (activity.origem === 'PERSONALIZADA' && activity.profissionalId !== professionalId)) {
                throw new ProgramResourceNotFoundError(`Atividade '${activityId}' não encontrada.`)
            }
            activities.push({ activityId, order: index + 1 })
        }

        return this.programRepository.create({
            professionalId,
            studentId: data.studentId,
            name: data.name,
            modalityId: data.modalityId,
            activities
        })
    }
}