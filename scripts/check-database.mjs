import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL não foi encontrada. Confira o .env da API.')
  process.exitCode = 1
} else {
  const prisma = new PrismaClient({
    adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL })
  })

  try {
    await prisma.$queryRaw`SELECT 1 AS ok`
    const [users, modalities, activities, programs, sessions] = await Promise.all([
      prisma.user.count(),
      prisma.modality.count(),
      prisma.activity.count(),
      prisma.program.count(),
      prisma.workoutSession.count()
    ])

    console.log('Conexão Prisma → Neon: OK')
    console.log('Consultas de leitura: OK')
    console.log({ users, modalities, activities, programs, sessions })
  } catch (error) {
    console.error('Não foi possível conectar ou consultar as tabelas do Neon.')
    console.error(error instanceof Error ? error.message : 'Erro desconhecido')
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}
