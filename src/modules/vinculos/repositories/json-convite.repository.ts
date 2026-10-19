
import { randomUUID } from 'node:crypto'
import {
    readFile,
    writeFile,
    rename,
    unlink
} from 'node:fs/promises'
import { Convite, DadosCriacaoConvite } from '../convite.types.js'
import { ConviteRepository } from './convite.repository.js'

export class JsonConviteRepository implements ConviteRepository {
    private operacoesPendentes: Promise<void> = Promise.resolve()

    constructor(private readonly caminhoArquivo: string) { }

    private executarEmSequencia<T>(
        operacao: () => Promise<T>
    ): Promise<T> {
        const resultado = this.operacoesPendentes.then(operacao)

        this.operacoesPendentes = resultado.then(
            () => undefined,
            () => undefined
        )

        return resultado
    }

    private async lerArquivo(): Promise<Convite[]> {
        try {
            const conteudo = await readFile(this.caminhoArquivo, 'utf-8')

            const convites = JSON.parse(conteudo) as Array<{
                id: string
                codigo: string
                profissionalId: string
                alunoId: string
                status: Convite['status']
                criadoEm: string
                expiraEm: string
            }>

            return convites.map((convite) => ({
                ...convite,
                criadoEm: new Date(convite.criadoEm),
                expiraEm: new Date(convite.expiraEm)
            }))
        } catch (erro) {
            if ((erro as NodeJS.ErrnoException).code === 'ENOENT') {
                return []
            }

            throw erro
        }
    }

    private async salvarArquivo(convites: Convite[]): Promise<void> {
        const caminhoTemporario = `${this.caminhoArquivo}.${randomUUID()}.tmp`

        try {
            await writeFile(
                caminhoTemporario,
                JSON.stringify(convites, null, 2),
                'utf-8'
            )

            await rename(caminhoTemporario, this.caminhoArquivo)
        } catch (erro) {
            await unlink(caminhoTemporario).catch(() => undefined)
            throw erro
        }
    }

    async criar(dados: DadosCriacaoConvite): Promise<Convite> {
        return this.executarEmSequencia(async () => {
            const convites = await this.lerArquivo()

            const convite: Convite = {
                id: randomUUID(),
                codigo: dados.codigo,
                profissionalId: dados.profissionalId,
                alunoId: dados.alunoId,
                status: 'PENDENTE',
                criadoEm: new Date(),
                expiraEm: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            }

            convites.push(convite)

            await this.salvarArquivo(convites)

            return convite
        })
    }

    async buscarPorCodigo(codigo: string): Promise<Convite | null> {
        const convites = await this.lerArquivo()

        return convites.find((convite) => convite.codigo === codigo) ?? null
    }

    async atualizar(conviteAtualizado: Convite): Promise<Convite | null> {
        return this.executarEmSequencia(async () => {
            const convites = await this.lerArquivo()

            const indice = convites.findIndex(
                (convite) => convite.id === conviteAtualizado.id
            )

            if (indice === -1) {
                return null
            }

            convites[indice] = conviteAtualizado

            await this.salvarArquivo(convites)

            return conviteAtualizado
        })
    }
}
