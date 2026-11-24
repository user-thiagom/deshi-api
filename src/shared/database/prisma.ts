import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { env } from '../../config/env.js'

const adapter = new PrismaNeon({ connectionString: env.databaseUrl })

const globalForPrisma = globalThis as typeof globalThis & { deshiPrisma?: PrismaClient }

export const prisma = globalForPrisma.deshiPrisma ?? new PrismaClient({ adapter })

if (env.nodeEnv !== 'production') globalForPrisma.deshiPrisma = prisma
