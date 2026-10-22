import { UserRepository } from '../users/repositories/user.repository.js'
import { toUserResponse } from '../users/users.mapper.js'
import { UserResponse } from '../users/users.types.js'
import { VinculoRepository } from './repositories/vinculo.repository.js'
import {
    AlunoNaoEncontradoError,
    SolicitacaoNaoPertenceAoAlunoError,
    UsuarioNaoEhAlunoError,
    VinculoConsigoMesmoError,
    VinculoJaExistenteError,
    VinculoNaoEncontradoError,
    VinculoNaoEstaPendenteError
} from './vinculos.errors.js'
import { CriarVinculoBody } from './vinculos.schema.js'
import { Vinculo } from './vinculos.types.js'

export class VinculoService {
    private operacoesPendentes: Promise<void> = Promise.resolve()

    constructor(
        private readonly vinculoRepository: VinculoRepository,
        private readonly userRepository: UserRepository
    ) { }

    // Serializa a consulta e a gravação para evitar conflitos nesta instância da aplicação.
    private executarEmSequencia<T>(operacao: () => Promise<T>): Promise<T> {
        const resultado = this.operacoesPendentes.then(operacao)
        this.operacoesPendentes = resultado.then(() => undefined, () => undefined)
        return resultado
    }

    async listarAlunosVinculados(profissionalId: string): Promise<UserResponse[]> {
        const vinculos = await this.vinculoRepository.buscarAtivosPorProfissional(profissionalId)
        const alunos: UserResponse[] = []

        for (const vinculo of vinculos) {
            const aluno = await this.userRepository.findById(vinculo.alunoId)

            if (aluno?.profile === 'STUDENT') {
                alunos.push(toUserResponse(aluno))
            }
        }

        return alunos
    }

    async criarSolicitacao(profissionalId: string, dados: CriarVinculoBody): Promise<Vinculo> {
        return this.executarEmSequencia(async () => {
            if (profissionalId === dados.alunoId) {
                throw new VinculoConsigoMesmoError()
            }

            const aluno = await this.userRepository.findById(dados.alunoId)

            if (!aluno) {
                throw new AlunoNaoEncontradoError()
            }

            if (aluno.profile !== 'STUDENT') {
                throw new UsuarioNaoEhAlunoError()
            }

            const vinculos = await this.vinculoRepository.buscarEntreProfissionalEAluno(
                profissionalId,
                aluno.id
            )

            if (vinculos.some((vinculo) => vinculo.status === 'PENDENTE' || vinculo.status === 'ATIVO')) {
                throw new VinculoJaExistenteError()
            }

            return this.vinculoRepository.criar({
                profissionalId,
                alunoId: aluno.id,
                status: 'PENDENTE'
            })
        })
    }

    async aceitarSolicitacao(id: string, alunoId: string): Promise<Vinculo> {
        return this.responderSolicitacao(id, alunoId, 'ATIVO')
    }

    async recusarSolicitacao(id: string, alunoId: string): Promise<Vinculo> {
        return this.responderSolicitacao(id, alunoId, 'RECUSADO')
    }

    private async responderSolicitacao(id: string, alunoId: string, status: 'ATIVO' | 'RECUSADO'): Promise<Vinculo> {
        return this.executarEmSequencia(async () => {
            const vinculo = await this.vinculoRepository.buscarPorId(id)

            if (!vinculo) {
                throw new VinculoNaoEncontradoError()
            }

            if (vinculo.alunoId !== alunoId) {
                throw new SolicitacaoNaoPertenceAoAlunoError()
            }

            if (vinculo.status !== 'PENDENTE') {
                throw new VinculoNaoEstaPendenteError()
            }

            const vinculoAtualizado = await this.vinculoRepository.atualizar({
                ...vinculo,
                status,
                atualizadoEm: new Date()
            })

            if (!vinculoAtualizado) {
                throw new VinculoNaoEncontradoError()
            }

            return vinculoAtualizado
        })
    }
}
