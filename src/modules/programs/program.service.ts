import { UserRepository } from '../users/repositories/user.repository.js'
import { ConfiguracaoError } from '../configuracoes-atividades/configuracoes-atividades.errors.js'
import { definirCamposSchema } from '../configuracoes-atividades/configuracoes-atividades.schema.js'
import { METRICAS } from '../configuracoes-atividades/configuracoes-atividades.types.js'
import {
    ProgramAccessDeniedError,
    InvalidProgramDataError,
    ProgramNotOwnedError,
    ProgramResourceNotFoundError,
    StudentNotLinkedError
} from './program.errors.js'
import type { CreateProgramBody, UpdateProgramBody } from './program.schema.js'
import { ProgramCatalogRepository } from './repositories/program-catalog.repository.js'
import { ProgramRepository } from './repositories/program.repository.js'
import type { Program, ProgramActivity } from './program.types.js'

export interface ProgramWithProfessional {
    program: Program
    professional: { id: string; name: string } | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export class ProgramService {
    constructor(
        private readonly programRepository: ProgramRepository,
        private readonly catalogRepository: ProgramCatalogRepository,
        private readonly userRepository: Pick<UserRepository, 'findById'>
    ) { }

    private async validatePrescribedValues(
        activityId: string,
        prescribed: Record<string, number> | undefined
    ): Promise<void> {
        if (!this.catalogRepository.findActivityFields) {
            throw new Error('Validação dos campos da atividade indisponível.')
        }

        const definition = await this.catalogRepository.findActivityFields(activityId)
        if (!definition || definition.atividadeId !== activityId) {
            throw new ConfiguracaoError(
                409,
                `Defina os campos da atividade '${activityId}' antes de prescrevê-la.`
            )
        }

        const { campos } = definirCamposSchema.parse({ campos: definition.campos })
        const values: unknown = prescribed ?? {}
        if (!isRecord(values)) {
            throw new ConfiguracaoError(400, 'Valores prescritos inválidos.')
        }

        for (const [key, value] of Object.entries(values)) {
            const field = campos.find((item) => item.chave === key)
            if (!field || !Object.hasOwn(METRICAS, key)) {
                throw new ConfiguracaoError(400, `Parâmetro não permitido: ${key}.`)
            }
            if (typeof value !== 'number' || !Number.isFinite(value) ||
                (field.tipo !== 'decimal' && !Number.isSafeInteger(value))) {
                throw new ConfiguracaoError(400, `Tipo inválido: ${key}.`)
            }
            if (value < (field.min ?? METRICAS[field.chave].min) ||
                (field.max !== undefined && value > field.max)) {
                throw new ConfiguracaoError(400, `Valor fora dos limites: ${key}.`)
            }
        }

        for (const field of campos) {
            if (field.obrigatorio && !Object.hasOwn(values, field.chave)) {
                throw new ConfiguracaoError(400, `Parâmetro obrigatório: ${field.chave}.`)
            }
        }
    }

    private async validateProgramData(
        professionalId: string,
        data: CreateProgramBody
    ): Promise<ProgramActivity[]> {
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

        if (!Array.isArray(data.activities) || data.activities.length === 0) {
            throw new TypeError('Atividades do programa inválidas.')
        }

        const activityIds = new Set<string>()
        const orders = new Set<number>()
        const activities: ProgramActivity[] = []
        for (const activityData of data.activities) {
            if (!activityData || typeof activityData.activityId !== 'string' ||
                !Number.isSafeInteger(activityData.order) || activityData.order < 1) {
                throw new TypeError('Atividades do programa inválidas.')
            }
            if (activityIds.has(activityData.activityId)) {
                throw new InvalidProgramDataError('A atividade não pode ser repetida.')
            }
            if (orders.has(activityData.order)) {
                throw new InvalidProgramDataError('A ordem das atividades não pode ser repetida.')
            }
            activityIds.add(activityData.activityId)
            orders.add(activityData.order)

            const activity = await this.catalogRepository.findActivity(activityData.activityId)
            if (!activity) {
                throw new ProgramResourceNotFoundError(`Atividade '${activityData.activityId}' não encontrada.`)
            }
            if (activity.modalidadeId !== data.modalityId) {
                throw new InvalidProgramDataError(
                    `Atividade '${activityData.activityId}' não pertence à modalidade informada.`
                )
            }
            if (activity.origem === 'PERSONALIZADA' && activity.profissionalId !== professionalId) {
                throw new ProgramResourceNotFoundError(`Atividade '${activityData.activityId}' não encontrada.`)
            }

            if (activityData.prescribed !== undefined) {
                await this.validatePrescribedValues(activityData.activityId, activityData.prescribed)
            }
            activities.push({
                activityId: activityData.activityId,
                order: activityData.order,
                ...(activityData.prescribed === undefined
                    ? {}
                    : { prescribed: { ...activityData.prescribed } })
            })
        }

        return activities.sort((first, second) => first.order - second.order)
    }

    async createProgram(professionalId: string, data: CreateProgramBody): Promise<Program> {
        const activities = await this.validateProgramData(professionalId, data)
        return this.programRepository.create({
            professionalId,
            studentId: data.studentId,
            name: data.name,
            modalityId: data.modalityId,
            activities
        })
    }

    async updateProgram(
        professionalId: string,
        programId: string,
        data: UpdateProgramBody
    ): Promise<Program> {
        const currentProgram = await this.programRepository.findById(programId)
        if (!currentProgram) {
            throw new ProgramResourceNotFoundError('Programa não encontrado.')
        }
        if (currentProgram.professionalId !== professionalId) {
            throw new ProgramNotOwnedError()
        }
        if (data.studentId !== currentProgram.studentId) {
            throw new ProgramNotOwnedError()
        }

        const activities = await this.validateProgramData(professionalId, data)
        return this.programRepository.update({
            ...currentProgram,
            name: data.name,
            modalityId: data.modalityId,
            activities
        })
    }

    private async attachProfessional(program: Program): Promise<ProgramWithProfessional> {
        const professional = await this.userRepository.findById(program.professionalId)
        return {
            program,
            professional: professional
                ? { id: professional.id, name: professional.name }
                : null
        }
    }

    async findProgramsForUser(userId: string): Promise<ProgramWithProfessional[]> {
        const user = await this.userRepository.findById(userId)
        if (!user) throw new ProgramAccessDeniedError()

        let programs: Program[]
        if (user.profile === 'STUDENT') {
            programs = await this.programRepository.findByStudentId(userId)
        } else if (user.profile === 'PROFESSIONAL' && this.programRepository.findByProfessionalId) {
            programs = await this.programRepository.findByProfessionalId(userId)
        } else {
            throw new ProgramAccessDeniedError()
        }

        return Promise.all(programs.map((program) => this.attachProfessional(program)))
    }

    async findProgramForUser(userId: string, programId: string): Promise<ProgramWithProfessional> {
        const user = await this.userRepository.findById(userId)
        if (!user) throw new ProgramAccessDeniedError()

        const program = await this.programRepository.findById(programId)
        if (!program) throw new ProgramResourceNotFoundError('Programa não encontrado.')

        const ownsProgram = user.profile === 'STUDENT'
            ? program.studentId === userId
            : user.profile === 'PROFESSIONAL' && program.professionalId === userId
        if (!ownsProgram) {
            throw new ProgramResourceNotFoundError('Programa não encontrado.')
        }

        return this.attachProfessional(program)
    }
}
