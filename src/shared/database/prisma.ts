import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { env } from '../../config/env.js'

// Vercel's Fastify builder traces files referenced by static fs calls. Prisma 6's
// client engine opens this WASM by a computed path, so make the asset visible to
// the tracer before Prisma tries to load it during the first query.
if (process.env.VERCEL) {
  const queryCompilerWasm = path.join(process.cwd(), 'node_modules', '.prisma', 'client', 'query_compiler_bg.wasm')
  readFileSync(queryCompilerWasm)
}

const adapter = new PrismaNeon({ connectionString: env.databaseUrl })

const globalForPrisma = globalThis as typeof globalThis & { deshiPrisma?: PrismaClient }

export const prisma = globalForPrisma.deshiPrisma ?? new PrismaClient({ adapter })

if (env.nodeEnv !== 'production') globalForPrisma.deshiPrisma = prisma
