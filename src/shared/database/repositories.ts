import { randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { prisma } from './prisma.js'
import type { UserRepository } from '../../modules/users/repositories/user.repository.js'
import type { CreateUserData, StudentBodyMetrics, StudentBodyMetricsInput, StudentProfileUpdate, User } from '../../modules/users/users.types.js'
import type { StudentBodyMetricsRepository } from '../../modules/users/repositories/user.repository.js'
import type { TokenRevocationRepository } from '../auth/repositories/token-revocation.repository.js'
import type { ModalidadeRepository } from '../../modules/modalidades/repositories/modalidade.repository.js'
import type { Modalidade } from '../../modules/modalidades/modalidades.types.js'
import type { AtividadeRepository } from '../../modules/atividades/repositories/atividade.repository.js'
import type { Atividade } from '../../modules/atividades/atividades.types.js'
import type { CamposRepository } from '../../modules/configuracoes-atividades/repositories/campos.repository.js'
import type { ConfiguracaoRepository } from '../../modules/configuracoes-atividades/repositories/configuracao.repository.js'
import type { CamposAtividade, ConfiguracaoAtividade } from '../../modules/configuracoes-atividades/configuracoes-atividades.types.js'
import type { VinculoRepository } from '../../modules/vinculos/repositories/vinculo.repository.js'
import type { DadosCriacaoVinculo, Vinculo } from '../../modules/vinculos/vinculos.types.js'
import type { ConviteRepository } from '../../modules/vinculos/repositories/convite.repository.js'
import type { Convite, DadosCriacaoConvite } from '../../modules/vinculos/convite.types.js'
import type { ProgramRepository } from '../../modules/programs/repositories/program.repository.js'
import type { Program, CreateProgramData, CatalogActivity } from '../../modules/programs/program.types.js'
import type { ProgramCatalogRepository } from '../../modules/programs/repositories/program-catalog.repository.js'
import type { SessionRepository } from '../../modules/sessions/repositories/session.repository.js'
import type { Session } from '../../modules/sessions/sessions.types.js'

const db = prisma as any
const asJson = <T>(value: unknown): T => value as T

export class PrismaUserRepository implements UserRepository, StudentBodyMetricsRepository {
  create(data: CreateUserData): Promise<User> { return db.user.create({ data: { id: randomUUID(), ...data } }) }
  findByEmail(email: string): Promise<User | null> { return db.user.findUnique({ where: { email } }) }
  findById(id: string): Promise<User | null> { return db.user.findUnique({ where: { id } }) }
  async updateStudentProfile(id: string, data: StudentProfileUpdate): Promise<User | null> {
    const where: Record<string, unknown> = { id, profile: 'STUDENT' }
    if (data.birthDate) where.birthDate = null
    if (data.gender) where.gender = null
    const result = await db.user.updateMany({ where, data })
    return result.count ? db.user.findUnique({ where: { id } }) : null
  }
  async updatePasswordHash(id: string, passwordHash: string): Promise<boolean> {
    const result = await db.user.updateMany({ where: { id, profile: 'STUDENT' }, data: { passwordHash } })
    return result.count > 0
  }
  async findBodyMetricsByStudentId(studentId: string): Promise<StudentBodyMetrics | null> {
    const user = await db.user.findFirst({ where: { id: studentId, profile: 'STUDENT' }, select: { birthDate: true, gender: true, weightKg: true, heightCm: true, bodyMetricsUpdatedAt: true, weightHistory: { orderBy: { recordedAt: 'asc' } } } })
    return user?.weightKg == null || user.heightCm == null || user.bodyMetricsUpdatedAt == null
      ? null
      : {
          weightKg: user.weightKg,
          heightCm: user.heightCm,
          bmi: Number((user.weightKg / ((user.heightCm / 100) ** 2)).toFixed(2)),
          updatedAt: user.bodyMetricsUpdatedAt,
          birthDate: user.birthDate,
          gender: user.gender,
          history: user.weightHistory.length
            ? user.weightHistory
            : [{ id: 'current', weightKg: user.weightKg, heightCm: user.heightCm, bmi: Number((user.weightKg / ((user.heightCm / 100) ** 2)).toFixed(2)), recordedAt: user.bodyMetricsUpdatedAt }],
        }
  }
  async updateBodyMetricsByStudentId(studentId: string, metrics: StudentBodyMetricsInput): Promise<StudentBodyMetrics | null> {
    const updatedAt = new Date()
    const bmi = Number((metrics.weightKg / ((metrics.heightCm / 100) ** 2)).toFixed(2))
    return db.$transaction(async (tx: any) => {
      const previous = await tx.user.findFirst({
        where: { id: studentId, profile: 'STUDENT' },
        select: { birthDate: true, gender: true, weightKg: true, heightCm: true, bodyMetricsUpdatedAt: true },
      })
      if (!previous) return null
      const existingHistory = await tx.studentWeightRecord.count({ where: { studentId } })
      if (!existingHistory && previous.weightKg != null && previous.heightCm != null && previous.bodyMetricsUpdatedAt != null) {
        await tx.studentWeightRecord.create({
          data: {
            id: randomUUID(),
            studentId,
            weightKg: previous.weightKg,
            heightCm: previous.heightCm,
            bmi: Number((previous.weightKg / ((previous.heightCm / 100) ** 2)).toFixed(2)),
            recordedAt: previous.bodyMetricsUpdatedAt,
          },
        })
      }
      const result = await tx.user.updateMany({ where: { id: studentId, profile: 'STUDENT' }, data: { weightKg: metrics.weightKg, heightCm: metrics.heightCm, bodyMetricsUpdatedAt: updatedAt } })
      if (result.count === 0) return null
      await tx.studentWeightRecord.create({ data: { id: randomUUID(), studentId, ...metrics, bmi, recordedAt: updatedAt } })
      const history = await tx.studentWeightRecord.findMany({ where: { studentId }, orderBy: { recordedAt: 'asc' } })
      return { ...metrics, bmi, updatedAt, birthDate: previous.birthDate, gender: previous.gender, history }
    })
  }
}

export class PrismaTokenRevocationRepository implements TokenRevocationRepository {
  async revoke(jti: string, expiresAt: Date): Promise<void> {
    await db.revokedToken.upsert({ where: { jti }, create: { jti, expiresAt }, update: { expiresAt } })
    await db.revokedToken.deleteMany({ where: { expiresAt: { lte: new Date() } } })
  }
  async isRevoked(jti: string): Promise<boolean> {
    return Boolean(await db.revokedToken.findFirst({ where: { jti, expiresAt: { gt: new Date() } }, select: { jti: true } }))
  }
}

export class PrismaModalidadeRepository implements ModalidadeRepository {
  async listarCatalogo(): Promise<Modalidade[]> {
    return (await db.modality.findMany({ orderBy: { name: 'asc' } })).map((m: any) => ({ id: m.id, nome: m.name }))
  }
  async buscarIdsPorProfissional(profissionalId: string): Promise<string[]> {
    const rows = await db.professionalModality.findMany({ where: { professionalId: profissionalId }, select: { modalityId: true } })
    return rows.map((row: any) => row.modalityId)
  }
  async substituirSelecao(profissionalId: string, modalidadeIds: string[]): Promise<void> {
    await db.$transaction(async (tx: any) => {
      await tx.professionalModality.deleteMany({ where: { professionalId: profissionalId } })
      if (modalidadeIds.length) await tx.professionalModality.createMany({ data: modalidadeIds.map((modalityId) => ({ professionalId: profissionalId, modalityId })) })
    })
  }
}

export class PrismaAtividadeRepository implements AtividadeRepository {
  async listar(): Promise<Atividade[]> {
    const rows = await db.activity.findMany({ orderBy: { name: 'asc' } })
    return rows.map((a: any) => ({ id: a.id, nome: a.name, ...(a.description === null ? {} : { descricao: a.description }), ...(a.mediaUrl === null ? {} : { midiaUrl: a.mediaUrl }), ...(a.muscleGroup === null ? {} : { grupoMuscular: a.muscleGroup }), modalidadeId: a.modalityId, origem: a.origin, profissionalId: a.professionalId }))
  }
  async criar(a: Atividade): Promise<void> {
    await db.activity.create({ data: { id: a.id, name: a.nome, description: a.descricao ?? null, mediaUrl: a.midiaUrl ?? null, muscleGroup: a.grupoMuscular ?? null, modalityId: a.modalidadeId, origin: a.origem, professionalId: a.profissionalId } })
  }
  async atualizar(a: Atividade): Promise<boolean> {
    const result = await db.activity.updateMany({ where: { id: a.id, origin: 'PERSONALIZADA', professionalId: a.profissionalId }, data: { name: a.nome, description: a.descricao ?? null, mediaUrl: a.midiaUrl ?? null, muscleGroup: a.grupoMuscular ?? null, modalityId: a.modalidadeId } })
    return result.count > 0
  }
}

export class PrismaCamposRepository implements CamposRepository {
  async buscarPorAtividade(atividadeId: string): Promise<CamposAtividade | null> {
    const row = await db.activityFieldDefinition.findUnique({ where: { activityId: atividadeId } })
    return row ? { atividadeId, campos: asJson<CamposAtividade['campos']>(row.fields) } : null
  }
  async criarPersonalizada(definicao: CamposAtividade): Promise<void> {
    await db.activityFieldDefinition.create({ data: { activityId: definicao.atividadeId, fields: definicao.campos } })
  }
}

export class PrismaConfiguracaoRepository implements ConfiguracaoRepository {
  async listar(): Promise<ConfiguracaoAtividade[]> {
    return (await db.activityConfiguration.findMany()).map((row: any) => ({ id: row.id, atividadeId: row.activityId, profissionalId: row.professionalId, valores: asJson(row.values), criadoEm: row.createdAt.toISOString(), atualizadoEm: row.updatedAt.toISOString() }))
  }
  async buscarPorId(id: string): Promise<ConfiguracaoAtividade | null> {
    const row = await db.activityConfiguration.findUnique({ where: { id } })
    return row ? { id: row.id, atividadeId: row.activityId, profissionalId: row.professionalId, valores: asJson(row.values), criadoEm: row.createdAt.toISOString(), atualizadoEm: row.updatedAt.toISOString() } : null
  }
  async criar(c: ConfiguracaoAtividade): Promise<void> {
    await db.activityConfiguration.create({ data: { id: c.id, activityId: c.atividadeId, professionalId: c.profissionalId, values: c.valores, createdAt: new Date(c.criadoEm), updatedAt: new Date(c.atualizadoEm) } })
  }
}

export class PrismaVinculoRepository implements VinculoRepository {
  async criar(d: DadosCriacaoVinculo): Promise<Vinculo> { return db.link.create({ data: { id: randomUUID(), professionalId: d.profissionalId, studentId: d.alunoId, status: d.status }, select: { id: true, professionalId: true, studentId: true, status: true, createdAt: true, updatedAt: true } }).then((r: any) => ({ id: r.id, profissionalId: r.professionalId, alunoId: r.studentId, status: r.status, criadoEm: r.createdAt, atualizadoEm: r.updatedAt })) }
  async buscarPorId(id: string): Promise<Vinculo | null> { const r = await db.link.findUnique({ where: { id } }); return r ? this.map(r) : null }
  async buscarAtivosPorProfissional(id: string): Promise<Vinculo[]> { return (await db.link.findMany({ where: { professionalId: id, status: 'ATIVO' } })).map((r: any) => this.map(r)) }
  async buscarAtivosPorAluno(id: string): Promise<Vinculo[]> { return (await db.link.findMany({ where: { studentId: id, status: 'ATIVO' } })).map((r: any) => this.map(r)) }
  async buscarEntreProfissionalEAluno(professionalId: string, studentId: string): Promise<Vinculo[]> { return (await db.link.findMany({ where: { professionalId, studentId } })).map((r: any) => this.map(r)) }
  async atualizar(v: Vinculo): Promise<Vinculo | null> { const r = await db.link.updateMany({ where: { id: v.id }, data: { status: v.status } }); return r.count ? this.buscarPorId(v.id) : null }
  async remover(id: string): Promise<boolean> { return (await db.link.deleteMany({ where: { id } })).count > 0 }
  private map(r: any): Vinculo { return { id: r.id, profissionalId: r.professionalId, alunoId: r.studentId, status: r.status, criadoEm: r.createdAt, atualizadoEm: r.updatedAt } }
}

export class PrismaConviteRepository implements ConviteRepository {
  async criar(d: DadosCriacaoConvite): Promise<Convite> { const r = await db.invite.create({ data: { id: randomUUID(), code: d.codigo, professionalId: d.profissionalId, studentId: d.alunoId, status: 'PENDENTE', expiresAt: new Date(Date.now() + 7 * 86400000) } }); return this.map(r) }
  async buscarPorCodigo(codigo: string): Promise<Convite | null> { const r = await db.invite.findUnique({ where: { code: codigo } }); return r ? this.map(r) : null }
  async buscarPendenteEntreProfissionalEAluno(profissionalId: string, alunoId: string): Promise<Convite | null> { const r = await db.invite.findFirst({ where: { professionalId: profissionalId, studentId: alunoId, status: 'PENDENTE', expiresAt: { gt: new Date() } } }); return r ? this.map(r) : null }
  async buscarAceitoEntreProfissionalEAluno(profissionalId: string, alunoId: string): Promise<Convite | null> { const r = await db.invite.findFirst({ where: { professionalId: profissionalId, studentId: alunoId, status: 'ACEITO' }, orderBy: { createdAt: 'desc' } }); return r ? this.map(r) : null }
  async listarPendentesAtivosPorProfissional(profissionalId: string): Promise<Convite[]> { return (await db.invite.findMany({ where: { professionalId: profissionalId, status: 'PENDENTE', expiresAt: { gt: new Date() } }, orderBy: { expiresAt: 'asc' } })).map((r: any) => this.map(r)) }
  async atualizar(c: Convite): Promise<Convite | null> { const r = await db.invite.updateMany({ where: { id: c.id }, data: { status: c.status } }); if (!r.count) return null; const row = await db.invite.findUnique({ where: { id: c.id } }); return row ? this.map(row) : null }
  private map(r: any): Convite { return { id: r.id, codigo: r.code, profissionalId: r.professionalId, alunoId: r.studentId, status: r.status, criadoEm: r.createdAt, expiraEm: r.expiresAt } }
}

function programMap(r: any): Program {
  return { id: r.id, professionalId: r.professionalId, studentId: r.studentId, name: r.name, modalityId: r.modalityId, ...(r.iconUrl ? { iconeUrl: r.iconUrl } : {}), version: r.version, createdAt: r.createdAt, activities: r.activities.map((a: any) => ({ activityId: a.activityId, order: a.order, ...(a.prescribed == null ? {} : { prescribed: asJson(a.prescribed) }), ...(a.activity?.name ? { nome: a.activity.name } : {}), ...(a.activity?.mediaUrl ? { midiaUrl: a.activity.mediaUrl } : {}), ...(a.activity?.muscleGroup ? { grupoMuscular: a.activity.muscleGroup } : {}) })).sort((a: any, b: any) => a.order - b.order) }
}

export class PrismaProgramRepository implements ProgramRepository {
  private include = { activities: { include: { activity: true }, orderBy: { order: 'asc' } } }
  async create(data: CreateProgramData): Promise<Program> {
    const r = await db.program.create({ data: { id: randomUUID(), professionalId: data.professionalId, studentId: data.studentId, name: data.name, modalityId: data.modalityId, iconUrl: data.iconeUrl ?? null, version: 1, activities: { create: data.activities.map(a => ({ order: a.order, activityId: a.activityId, prescribed: a.prescribed ?? undefined })) } }, include: this.include })
    return programMap(r)
  }
  async findById(id: string): Promise<Program | null> { const r = await db.program.findUnique({ where: { id }, include: this.include }); return r ? programMap(r) : null }
  async findByStudentId(studentId: string): Promise<Program[]> { return (await db.program.findMany({ where: { studentId }, include: this.include, orderBy: { createdAt: 'desc' } })).map(programMap) }
  async findByStudentIdWithActiveProfessional(studentId: string): Promise<Program[]> {
    return (await db.program.findMany({
      where: { studentId, professional: { professionalLinks: { some: { studentId, status: 'ATIVO' } } } },
      include: this.include,
      orderBy: { createdAt: 'desc' }
    })).map(programMap)
  }
  async findByProfessionalId(professionalId: string): Promise<Program[]> { return (await db.program.findMany({ where: { professionalId }, include: this.include, orderBy: { createdAt: 'desc' } })).map(programMap) }
  async update(updated: Program): Promise<Program> {
    return db.$transaction(async (tx: any) => {
      const current = await tx.program.findUnique({ where: { id: updated.id }, include: this.include })
      if (!current) throw new Error('Programa não encontrado.')
      const old = programMap(current)
      const comparable = (p: Program) => ({ professionalId: p.professionalId, studentId: p.studentId, name: p.name, modalityId: p.modalityId, iconeUrl: p.iconeUrl, activities: p.activities.map(a => ({ activityId: a.activityId, order: a.order, prescribed: a.prescribed })) })
      const changed = !isDeepStrictEqual(comparable(old), comparable(updated))
      await tx.program.update({ where: { id: updated.id }, data: { professionalId: updated.professionalId, studentId: updated.studentId, name: updated.name, modalityId: updated.modalityId, iconUrl: updated.iconeUrl ?? null, version: current.version + (changed ? 1 : 0) } })
      await tx.programActivity.deleteMany({ where: { programId: updated.id } })
      if (updated.activities.length) await tx.programActivity.createMany({ data: updated.activities.map(a => ({ programId: updated.id, activityId: a.activityId, order: a.order, prescribed: a.prescribed ?? undefined })) })
      return programMap(await tx.program.findUnique({ where: { id: updated.id }, include: this.include }))
    })
  }
}

export class PrismaProgramCatalogRepository implements ProgramCatalogRepository {
  async isStudentLinkedToProfessional(professionalId: string, studentId: string): Promise<boolean> { return Boolean(await db.link.findFirst({ where: { professionalId, studentId, status: 'ATIVO' }, select: { id: true } })) }
  async hasProfessionalModality(professionalId: string, modalityId: string): Promise<boolean> { return Boolean(await db.professionalModality.findUnique({ where: { professionalId_modalityId: { professionalId, modalityId } } })) }
  async findActivity(activityId: string): Promise<CatalogActivity | null> { const a = await db.activity.findUnique({ where: { id: activityId } }); return a ? { id: a.id, nome: a.name, midiaUrl: a.mediaUrl ?? undefined, grupoMuscular: a.muscleGroup ?? undefined, modalidadeId: a.modalityId, origem: a.origin, profissionalId: a.professionalId } : null }
  async findActivityFields(activityId: string): Promise<CamposAtividade | null> { const r = await db.activityFieldDefinition.findUnique({ where: { activityId } }); return r ? { atividadeId: activityId, campos: asJson(r.fields) } : null }
}

function asDate(value: any): Date | undefined { return value ? new Date(value) : undefined }
function sessionMap(r: any): Session {
  return { id: r.id, programId: r.programId ?? r.legacyProgramId ?? '', ...(r.programVersion === null ? {} : { programVersion: r.programVersion }), studentId: r.studentId, professionalId: r.professionalId, startedAt: r.startedAt, ...(r.pauseStartedAt ? { pauseStartedAt: r.pauseStartedAt } : {}), ...(r.pausedDurationMs === null ? {} : { pausedDurationMs: Number(r.pausedDurationMs) }), ...(r.finishedAt ? { finishedAt: r.finishedAt } : {}), status: r.status, activities: r.activities.map((a: any) => {
    const execution = a.execution ? asJson<any>(a.execution) : undefined
    if (execution?.executedAt) execution.executedAt = asDate(execution.executedAt)
    if (execution?.series) execution.series = execution.series.map((s: any) => ({ ...s, executedAt: asDate(s.executedAt) }))
    const tracking = a.timeTracking ? asJson<any>(a.timeTracking) : undefined
    for (const key of ['activeStartedAt', 'pauseStartedAt', 'restStartedAt']) if (tracking?.[key]) tracking[key] = asDate(tracking[key])
    for (const key of ['activeIntervals', 'pauseIntervals', 'restIntervals']) if (tracking?.[key]) tracking[key] = tracking[key].map((i: any) => ({ startedAt: asDate(i.startedAt), ...(i.endedAt ? { endedAt: asDate(i.endedAt) } : {}) }))
    return { activityId: a.activityId, order: a.order, status: a.status, ...(a.nameSnapshot ? { nome: a.nameSnapshot } : {}), ...(a.mediaUrlSnapshot ? { midiaUrl: a.mediaUrlSnapshot } : {}), ...(a.muscleGroupSnapshot ? { grupoMuscular: a.muscleGroupSnapshot } : {}), ...(tracking ? { timeTracking: tracking } : {}), ...(a.observations.length ? { observations: a.observations } : {}), ...(a.prescribed == null ? {} : { prescribed: asJson(a.prescribed) }), ...(execution ? { execution } : {}) }
  }).sort((a: any, b: any) => a.order - b.order) }
}

export class PrismaSessionRepository implements SessionRepository {
  private include = { activities: { orderBy: { order: 'asc' } } }
  async create(s: Session): Promise<Session> {
    const r = await db.workoutSession.create({ data: { id: s.id, programId: s.programId, programVersion: s.programVersion ?? null, studentId: s.studentId, professionalId: s.professionalId, startedAt: s.startedAt, pauseStartedAt: s.pauseStartedAt ?? null, pausedDurationMs: s.pausedDurationMs == null ? null : BigInt(s.pausedDurationMs), finishedAt: s.finishedAt ?? null, status: s.status, activities: { create: s.activities.map(a => ({ activityId: a.activityId, order: a.order, status: a.status, nameSnapshot: a.nome ?? null, mediaUrlSnapshot: a.midiaUrl ?? null, muscleGroupSnapshot: a.grupoMuscular ?? null, timeTracking: a.timeTracking ?? undefined, observations: a.observations ?? [], prescribed: a.prescribed ?? undefined, execution: a.execution ?? undefined })) } }, include: this.include })
    return sessionMap(r)
  }
  async findById(id: string): Promise<Session | null> { const r = await db.workoutSession.findUnique({ where: { id }, include: this.include }); return r ? sessionMap(r) : null }
  async findByStudentId(studentId: string): Promise<Session[]> { return (await db.workoutSession.findMany({ where: { studentId }, include: this.include, orderBy: { startedAt: 'desc' } })).map(sessionMap) }
  async findByProfessionalId(professionalId: string): Promise<Session[]> { return (await db.workoutSession.findMany({ where: { professionalId }, include: this.include, orderBy: { startedAt: 'desc' } })).map(sessionMap) }
  async update(s: Session): Promise<Session> {
    const r = await db.$transaction(async (tx: any) => {
      const exists = await tx.workoutSession.findUnique({ where: { id: s.id }, select: { id: true } })
      if (!exists) throw new Error('Sessão não encontrada.')
      await tx.workoutSession.update({ where: { id: s.id }, data: { programVersion: s.programVersion ?? null, startedAt: s.startedAt, pauseStartedAt: s.pauseStartedAt ?? null, pausedDurationMs: s.pausedDurationMs == null ? null : BigInt(s.pausedDurationMs), finishedAt: s.finishedAt ?? null, status: s.status } })
      await tx.sessionActivity.deleteMany({ where: { sessionId: s.id } })
      if (s.activities.length) await tx.sessionActivity.createMany({ data: s.activities.map(a => ({ sessionId: s.id, activityId: a.activityId, order: a.order, status: a.status, nameSnapshot: a.nome ?? null, mediaUrlSnapshot: a.midiaUrl ?? null, muscleGroupSnapshot: a.grupoMuscular ?? null, timeTracking: a.timeTracking ?? undefined, observations: a.observations ?? [], prescribed: a.prescribed ?? undefined, execution: a.execution ?? undefined })) })
      return tx.workoutSession.findUnique({ where: { id: s.id }, include: this.include })
    })
    return sessionMap(r)
  }
}
