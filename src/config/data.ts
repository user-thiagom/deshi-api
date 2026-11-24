import { link, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

const vercelDataDirectory = '/tmp/deshi/data'
const onVercel = process.env.VERCEL === '1'

export function dataPath(filename: string): string {
    return path.join(onVercel ? vercelDataDirectory : 'data', filename)
}

export async function initializeData(): Promise<void> {
    if (!onVercel) return

    const seeds = path.resolve('data')
    await mkdir(vercelDataDirectory, { recursive: true })
    const staging = await mkdtemp(path.join(vercelDataDirectory, '.init-'))
    try {
        for (const filename of await readdir(seeds)) {
            if (!filename.endsWith('.json')) continue
            const copy = path.join(staging, filename)
            await writeFile(copy, await readFile(path.join(seeds, filename)), { mode: 0o600 })
            // Publica a cópia completa sem substituir dados de outra inicialização.
            try {
                await link(copy, dataPath(filename))
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
            }
        }
    } finally {
        await rm(staging, { recursive: true, force: true })
    }
}
