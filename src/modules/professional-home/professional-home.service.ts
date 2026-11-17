import type { UserRepository } from '../users/repositories/user.repository.js'
import type { VinculoRepository } from '../vinculos/repositories/vinculo.repository.js'
import type { ProgramRepository } from '../programs/repositories/program.repository.js'
import type { SessionRepository } from '../sessions/repositories/session.repository.js'
import type { AtividadeRepository } from '../atividades/repositories/atividade.repository.js'
import type { User } from '../users/users.types.js'

const PROFESSIONAL_TIME_ZONE = 'America/Sao_Paulo'

function localDateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PROFESSIONAL_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date)
}

export class ProfessionalHomeService {
  constructor(
    private readonly users: UserRepository,
    private readonly links: VinculoRepository,
    private readonly programs: ProgramRepository,
    private readonly sessions: SessionRepository,
    private readonly activities: Pick<AtividadeRepository, 'listar'>
  ) {}

  async getDashboard(professionalId: string) {
    const [links, sessions, programs, activities] = await Promise.all([
      this.links.buscarAtivosPorProfissional(professionalId),
      this.sessions.findByProfessionalId(professionalId),
      this.programs.findByProfessionalId?.(professionalId) ?? Promise.resolve([]),
      this.activities.listar()
    ])
    const students = await Promise.all(links.map((link) => this.users.findById(link.alunoId)))
    const studentById = new Map(students.filter((student): student is User => student?.profile === 'STUDENT').map((student) => [student.id, student]))
    const studentIds = new Set(studentById.keys())
    const today = localDateKey(new Date())
    const todaySessions = sessions.filter((session) => studentIds.has(session.studentId) && localDateKey(new Date(session.startedAt)) === today)
    const activeSessions = todaySessions.filter((session) => session.status === 'IN_PROGRESS')
    const completedStudentIds = new Set(todaySessions.filter((session) => session.status === 'COMPLETED').map((session) => session.studentId))
    const startedStudentIds = new Set(todaySessions.map((session) => session.studentId))
    const programById = new Map(programs.map((program) => [program.id, program]))
    const activityById = new Map(activities.map((activity) => [activity.id, activity]))

    const training = await Promise.all(activeSessions.map(async (session) => {
      const student = studentById.get(session.studentId)
      const program = programById.get(session.programId)
      const currentActivity = session.activities.find((activity) => ['IN_PROGRESS', 'PAUSED', 'RESTING'].includes(activity.status))
      return {
        sessionId: session.id,
        name: student?.name ?? 'Aluno',
        programName: program?.name ?? 'Treino do aluno',
        activityName: currentActivity ? activityById.get(currentActivity.activityId)?.nome ?? 'Atividade em andamento' : null,
        completedActivities: session.activities.filter((activity) => activity.status === 'COMPLETED').length,
        totalActivities: session.activities.length,
        startedAt: session.startedAt
      }
    }))

    const recentActivities = await Promise.all(sessions
      .filter((session) => studentIds.has(session.studentId) && session.status === 'COMPLETED' && session.finishedAt)
      .sort((a, b) => new Date(b.finishedAt!).getTime() - new Date(a.finishedAt!).getTime())
      .slice(0, 6)
      .map(async (session) => {
        const student = studentById.get(session.studentId)
        const program = programById.get(session.programId)
        return {
          id: session.id,
          type: 'completed',
          title: `${student?.name ?? 'Aluno'} concluiu ${program?.name ?? 'o treino'}`,
          description: `${session.activities.filter((activity) => activity.status === 'COMPLETED').length}/${session.activities.length} atividades concluídas`,
          at: session.finishedAt
        }
      }))

    return {
      counts: {
        training: new Set(activeSessions.map((session) => session.studentId)).size,
        completed: completedStudentIds.size,
        notStarted: [...studentIds].filter((id) => !startedStudentIds.has(id)).length
      },
      training,
      recentActivities
    }
  }
}
