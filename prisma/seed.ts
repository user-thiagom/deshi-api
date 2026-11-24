import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Prisma } from '@prisma/client'
import { prisma } from '../src/shared/database/prisma.js'

type JsonRecord = Record<string, any>
const dataDirectory = join(process.cwd(), 'data')
async function read(name: string): Promise<JsonRecord[]> {
  return JSON.parse(await readFile(join(dataDirectory, `${name}.json`), 'utf8'))
}
const optional = (value: unknown) => value == null || value === '' ? null : value
const stableId = (value: string) => {
  const hex = createHash('sha256').update(`deshi:${value}`).digest('hex').slice(0, 32)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`
}
const normalizeModalityId = (id: string) => id === 'd1b10e90-8d5c-4ad3-9d1d-000000000001'
  ? 'd1b10e90-8d5c-4ad3-9d68-000000000001'
  : id
const json = (value: unknown) => value == null ? Prisma.JsonNull : value as Prisma.InputJsonValue

async function main() {
  const [users, links, invites, modalities, modalitySelections, revokedTokens, standardActivities, customActivities,
    standardFields, customFields, configurations, programs, sessions] = await Promise.all([
    read('users'), read('vinculos'), read('convites'), read('modalidades'), read('profissional-modalidades'), read('revoked-tokens'),
    read('atividades'), read('atividades-personalizadas'), read('campos-configuracao-atividades'),
    read('campos-configuracao-personalizadas'), read('configuracoes-atividades'), read('programs'), read('sessions')
  ])
  const allActivities = [...standardActivities, ...customActivities]
  const userIds = new Set(users.map(u => u.id))
  const modalityIds = new Set(modalities.map(m => m.id))
  const activityIds = new Set(allActivities.map(a => a.id))
  const assertRef = (condition: boolean, message: string) => { if (!condition) throw new Error(`Importação abortada: ${message}`) }
  const unique = (values: string[]) => new Set(values).size === values.length

  assertRef(userIds.size === users.length, 'há IDs de usuário repetidos.')
  assertRef(unique(users.map(u => String(u.email).toLowerCase())), 'há e-mails de usuário repetidos.')
  assertRef(modalityIds.size === modalities.length, 'há IDs de modalidade repetidos.')
  assertRef(activityIds.size === allActivities.length, 'há IDs de atividade repetidos.')
  for (const a of allActivities) {
    assertRef(modalityIds.has(a.modalidadeId), `atividade ${a.id} aponta para modalidade ausente ${a.modalidadeId}.`)
    assertRef(a.origem === 'PADRAO' ? !a.profissionalId : a.origem === 'PERSONALIZADA' && userIds.has(a.profissionalId), `origem ou proprietário inválido na atividade ${a.id}.`)
  }
  for (const selection of modalitySelections) {
    assertRef(users.some(u => u.id === selection.profissionalId && u.profile === 'PROFESSIONAL'), `seleção de modalidade pertence a usuário não profissional ${selection.profissionalId}.`)
    for (const modalityId of selection.modalidadeIds ?? []) assertRef(modalityIds.has(modalityId), `modalidade ${modalityId} ausente na seleção de ${selection.profissionalId}.`)
  }
  for (const p of programs) {
    assertRef(userIds.has(p.profissionalId) && userIds.has(p.alunoId), `usuário ausente no programa ${p.id}.`)
    assertRef(users.some(u => u.id === p.profissionalId && u.profile === 'PROFESSIONAL') && users.some(u => u.id === p.alunoId && u.profile === 'STUDENT'), `papéis inválidos no programa ${p.id}.`)
    assertRef(modalityIds.has(normalizeModalityId(p.modalidadeId)), `modalidade ausente no programa ${p.id}.`)
    assertRef(unique((p.atividades ?? []).map((a: JsonRecord) => String(a.ordem))), `ordem repetida nas atividades do programa ${p.id}.`)
    for (const a of p.atividades ?? []) assertRef(activityIds.has(a.atividadeId), `atividade ${a.atividadeId} ausente no programa ${p.id}.`)
  }
  for (const s of sessions) {
    assertRef(userIds.has(s.studentId) && userIds.has(s.professionalId), `usuário ausente na sessão ${s.id}.`)
    assertRef(users.some(u => u.id === s.professionalId && u.profile === 'PROFESSIONAL') && users.some(u => u.id === s.studentId && u.profile === 'STUDENT'), `papéis inválidos na sessão ${s.id}.`)
    assertRef(unique((s.activities ?? []).map((a: JsonRecord) => String(a.order))), `ordem repetida nas atividades da sessão ${s.id}.`)
    for (const a of s.activities ?? []) assertRef(activityIds.has(a.activityId), `atividade ${a.activityId} ausente na sessão ${s.id}.`)
  }
  for (const l of links) assertRef(userIds.has(l.profissionalId) && userIds.has(l.alunoId), 'vínculo referencia usuário ausente.')
  assertRef(unique(links.map(l => `${l.profissionalId}:${l.alunoId}`)), 'há pares profissional/aluno duplicados nos vínculos.')
  for (const i of invites) assertRef(userIds.has(i.profissionalId) && userIds.has(i.alunoId), `convite ${i.id} referencia usuário ausente.`)
  assertRef(unique(invites.map(i => i.codigo)), 'há códigos de convite duplicados.')
  for (const c of configurations) assertRef(activityIds.has(c.atividadeId) && userIds.has(c.profissionalId), `configuração ${c.id} referencia atividade ou profissional ausente.`)
  assertRef(unique([...standardFields, ...customFields].map(f => f.atividadeId)), 'há definições de campos duplicadas para a mesma atividade.')

  if (process.argv.includes('--check')) {
    console.log(`Validação concluída: ${users.length} usuários, ${modalities.length} modalidades, ${allActivities.length} atividades, ${programs.length} programas, ${sessions.length} sessões e ${revokedTokens.length} tokens revogados. Nenhum registro foi gravado.`)
    return
  }

  const activityFields = [...standardFields, ...customFields]
  const selections = modalitySelections.flatMap(selection => (selection.modalidadeIds ?? []).map((modalityId: string) => ({ professionalId: selection.profissionalId, modalityId })))
  const programRows = programs.map(p => ({ id: p.id, professionalId: p.profissionalId, studentId: p.alunoId, name: p.nome, modalityId: normalizeModalityId(p.modalidadeId), iconUrl: optional(p.iconeUrl), version: p.version ?? 1, createdAt: new Date(p.criadoEm) }))
  const programActivityRows = programs.flatMap(p => (p.atividades ?? []).map((a: JsonRecord) => ({ programId: p.id, activityId: a.atividadeId, order: a.ordem, prescribed: a.valores == null ? undefined : json(a.valores) })))
  const programIds = new Set(programs.map(p => p.id))
  const sessionRows = sessions.map(s => ({ id: s.id, programId: programIds.has(s.programId) ? s.programId : null, legacyProgramId: programIds.has(s.programId) ? null : s.programId, programVersion: s.programVersion ?? null, studentId: s.studentId, professionalId: s.professionalId, startedAt: new Date(s.startedAt), pauseStartedAt: s.pauseStartedAt ? new Date(s.pauseStartedAt) : null, pausedDurationMs: s.pausedDurationMs == null ? null : BigInt(s.pausedDurationMs), finishedAt: s.finishedAt ? new Date(s.finishedAt) : null, status: s.status }))
  const sessionActivityRows = sessions.flatMap(s => (s.activities ?? []).map((a: JsonRecord) => ({ sessionId: s.id, activityId: a.activityId, order: a.order, status: a.status, nameSnapshot: optional(a.nome), mediaUrlSnapshot: optional(a.midiaUrl), muscleGroupSnapshot: optional(a.grupoMuscular), timeTracking: a.timeTracking == null ? undefined : json(a.timeTracking), observations: a.observations ?? [], prescribed: a.prescribed == null ? undefined : json(a.prescribed), execution: a.execution == null ? undefined : json(a.execution) })))
  const linkRows = links.map(l => ({ id: l.id ?? stableId(`link:${l.profissionalId}:${l.alunoId}`), professionalId: l.profissionalId, studentId: l.alunoId, status: l.status, createdAt: new Date(l.criadoEm), updatedAt: new Date(l.atualizadoEm) }))
  const activityRows = allActivities.map(a => ({ id: a.id, name: a.nome, description: optional(a.descricao), mediaUrl: optional(a.midiaUrl), muscleGroup: optional(a.grupoMuscular), modalityId: a.modalidadeId, origin: a.origem, professionalId: optional(a.profissionalId) }))
  const chunks = async <T>(model: { createMany(args: any): Promise<unknown> }, rows: T[]) => {
    for (let offset = 0; offset < rows.length; offset += 400) {
      await model.createMany({ data: rows.slice(offset, offset + 400), skipDuplicates: true })
    }
  }

  await prisma.$transaction(async tx => {
    await chunks(tx.user, users.map(u => ({ id: u.id, name: u.name, email: u.email, passwordHash: u.passwordHash, profile: u.profile, createdAt: new Date(u.createdAt), updatedAt: new Date(u.updatedAt) })))
    await chunks(tx.modality, modalities.map(m => ({ id: m.id, name: m.nome })))
    await chunks(tx.professionalModality, selections)
    await chunks(tx.activity, activityRows)
    await chunks(tx.activityFieldDefinition, activityFields.map(f => ({ activityId: f.atividadeId, fields: json(f.campos) })))
    await chunks(tx.link, linkRows)
    await chunks(tx.invite, invites.map(i => ({ id: i.id, code: i.codigo, professionalId: i.profissionalId, studentId: i.alunoId, status: i.status, createdAt: new Date(i.criadoEm), expiresAt: new Date(i.expiraEm) })))
    await chunks(tx.activityConfiguration, configurations.map(c => ({ id: c.id, activityId: c.atividadeId, professionalId: c.profissionalId, values: json(c.valores), createdAt: new Date(c.criadoEm), updatedAt: new Date(c.atualizadoEm) })))
    await chunks(tx.program, programRows)
    await chunks(tx.programActivity, programActivityRows)
    await chunks(tx.workoutSession, sessionRows)
    await chunks(tx.sessionActivity, sessionActivityRows)
    await chunks(tx.revokedToken, revokedTokens.filter(t => new Date(t.expiresAt) > new Date()).map(t => ({ jti: t.jti, expiresAt: new Date(t.expiresAt) })))
  }, { timeout: 120000 })

  console.log(`Importação concluída: ${users.length} usuários, ${modalities.length} modalidades, ${allActivities.length} atividades, ${programs.length} programas e ${sessions.length} sessões.`)
}

main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => prisma.$disconnect())
