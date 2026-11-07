
import { promises as fs } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'

import type { CreateProgramData, Program } from '../program.types.js'
import type { ProgramRepository } from './program.repository.js'

function isValidActivity(activity: unknown): activity is Program['activities'][number] {
  if (
    activity === null ||
    typeof activity !== 'object' ||
    !('activityId' in activity) ||
    typeof activity.activityId !== 'string' ||
    activity.activityId.length === 0 ||
    !('order' in activity) ||
    typeof activity.order !== 'number' ||
    !Number.isSafeInteger(activity.order) ||
    activity.order < 1
  ) {
    return false
  }

  if (!('prescribed' in activity) || activity.prescribed === undefined) {
    return true
  }

  return activity.prescribed !== null &&
    typeof activity.prescribed === 'object' &&
    !Array.isArray(activity.prescribed) &&
    Object.values(activity.prescribed).every(
      (value) => typeof value === 'number' && Number.isFinite(value)
    )
}

function cloneActivity(activity: Program['activities'][number]): Program['activities'][number] {
  if (!isValidActivity(activity)) {
    throw new TypeError('Atividades do programa inválidas.')
  }

  return {
    activityId: activity.activityId,
    order: activity.order,
    ...(activity.prescribed === undefined
      ? {}
      : { prescribed: { ...activity.prescribed } })
  }
}

export class JsonProgramRepository implements ProgramRepository {
  constructor(private readonly filePath: string) {}

  private async readPrograms(): Promise<Program[]> {
    const content = await fs.readFile(this.filePath, 'utf-8')
    const programs = JSON.parse(content) as Array<Record<string, unknown>>

    return programs.map((stored) => {
      const activities = (stored.activities ?? stored.atividades) as Array<Record<string, unknown>>
      return {
        id: stored.id as string,
        professionalId: (stored.professionalId ?? stored.profissionalId) as string,
        studentId: (stored.studentId ?? stored.alunoId) as string,
        name: (stored.name ?? stored.nome) as string,
        modalityId: (stored.modalityId ?? stored.modalidadeId) as string,
        activities: activities.map((activity) => ({
          activityId: (activity.activityId ?? activity.atividadeId) as string,
          order: (activity.order ?? activity.ordem) as number,
          ...((activity.prescribed ?? activity.valores) === undefined
            ? {}
            : { prescribed: { ...(activity.prescribed ?? activity.valores) as Record<string, number> } })
        })),
        version: (stored.version as number | undefined) ?? 1,
        createdAt: new Date((stored.createdAt ?? stored.criadoEm) as string)
      }
    })
  }

  private serializeProgram(program: Program) {
    return {
      id: program.id,
      profissionalId: program.professionalId,
      alunoId: program.studentId,
      nome: program.name,
      modalidadeId: program.modalityId,
      atividades: program.activities.map((activity) => ({
        atividadeId: activity.activityId,
        ordem: activity.order,
        ...(activity.prescribed === undefined
          ? {}
          : { valores: { ...activity.prescribed } })
      })),
      version: program.version,
      criadoEm: program.createdAt
    }
  }

  private async writePrograms(programs: Program[]): Promise<void> {
    await fs.writeFile(
      this.filePath,
      JSON.stringify(programs.map((program) => this.serializeProgram(program)), null, 2)
    )
  }

  async create(data: CreateProgramData): Promise<Program> {
    if (!Array.isArray(data.activities) || !data.activities.every(isValidActivity)) {
      throw new TypeError('Atividades do programa inválidas.')
    }

    const program: Program = {
      id: randomUUID(),
      ...data,
      activities: data.activities.map(cloneActivity),
      version: 1,
      createdAt: new Date()
    }

    const programs = await this.readPrograms()
    programs.push(program)

    await this.writePrograms(programs)

    return program
  }

  async findById(id: string): Promise<Program | null> {
    const programs = await this.readPrograms()
    const program = programs.find((item) => item.id === id)

    return program
      ? {
          ...program,
          activities: program.activities.map(cloneActivity).sort(
            (first, second) => first.order - second.order
          )
        }
      : null
  }

  async findByStudentId(studentId: string): Promise<Program[]> {
    const programs = await this.readPrograms()

    return programs
      .filter((program) => program.studentId === studentId)
      .map((program) => ({
        ...program,
        activities: program.activities.map(cloneActivity).sort(
          (a, b) => a.order - b.order
        )
      }))
  }

  async findByProfessionalId(professionalId: string): Promise<Program[]> {
    const programs = await this.readPrograms()

    return programs
      .filter((program) => program.professionalId === professionalId)
      .map((program) => ({
        ...program,
        activities: program.activities.map(cloneActivity).sort(
          (a, b) => a.order - b.order
        )
      }))
  }

  async update(updatedProgram: Program): Promise<Program> {
    if (
      !Array.isArray(updatedProgram.activities) ||
      !updatedProgram.activities.every(isValidActivity)
    ) {
      throw new TypeError('Atividades do programa inválidas.')
    }

    const programs = await this.readPrograms()
    const index = programs.findIndex((program) => program.id === updatedProgram.id)

    if (index === -1) {
      throw new Error('Programa não encontrado.')
    }

    const currentProgram = programs[index]
    const {
      id: _currentId,
      version: _currentVersion,
      createdAt: _currentCreatedAt,
      ...currentData
    } = currentProgram
    const {
      id: _updatedId,
      version: _updatedVersion,
      createdAt: _updatedCreatedAt,
      ...updatedData
    } = updatedProgram
    const changed = !isDeepStrictEqual(currentData, updatedData)
    const program: Program = {
      ...updatedProgram,
      id: currentProgram.id,
      createdAt: currentProgram.createdAt,
      activities: updatedProgram.activities.map(cloneActivity),
      version: currentProgram.version + (changed ? 1 : 0)
    }

    programs[index] = program
    await this.writePrograms(programs)

    return program
  }
}
