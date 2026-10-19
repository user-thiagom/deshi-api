import { executarOperacaoVinculo } from './vinculos.concorrencia.js'
import {
    ConviteNaoEncontradoError, ProfissionalNaoEncontradoError,
    ConviteNaoPertenceAoAlunoError, ConviteIndisponivelError,
    ConviteExpiradoError, ConvitePendenteJaExistenteError, FalhaRollbackConviteError
} from './convite.errors.js'
import {
    AlunoNaoEncontradoError, UsuarioNaoEhAlunoError,
    VinculoConsigoMesmoError, VinculoJaExistenteError
} from './vinculos.errors.js'
import { randomInt } from 'node:crypto'
import { UserRepository } from '../users/repositories/user.repository.js'
import { toUserResponse } from '../users/users.mapper.js'
import { UserResponse } from '../users/users.types.js'
import { VinculoRepository } from './repositories/vinculo.repository.js'
import { ConviteRepository } from './repositories/convite.repository.js'
import { Convite } from './convite.types.js'

function gerarCodigoConvite(): string {
    const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let codigo = ''

    for (let i = 0; i < 8; i++) {
        codigo += caracteres[randomInt(caracteres.length)]
    }

    return codigo
}

export class ConviteService {
    constructor(
        private readonly conviteRepository: ConviteRepository,
        private readonly vinculoRepository: VinculoRepository,
        private readonly userRepository: UserRepository
    ) { }

    async criarConvite(
        profissionalId: string,
        alunoId: string
    ): Promise<Convite> {
        return executarOperacaoVinculo(async () => {
            if (profissionalId === alunoId) throw new VinculoConsigoMesmoError()

            const profissional = await this.userRepository.findById(profissionalId)

            if (!profissional || profissional.profile !== 'PROFESSIONAL') {
                throw new ProfissionalNaoEncontradoError()
            }

            const aluno = await this.userRepository.findById(alunoId)

            if (!aluno) throw new AlunoNaoEncontradoError()
            if (aluno.profile !== 'STUDENT') throw new UsuarioNaoEhAlunoError()

            const vinculos = await this.vinculoRepository.buscarEntreProfissionalEAluno(profissionalId, alunoId)
            if (vinculos.some((vinculo) => vinculo.status === 'PENDENTE' || vinculo.status === 'ATIVO')) {
                throw new VinculoJaExistenteError()
            }

            const pendente = await this.conviteRepository.buscarPendenteEntreProfissionalEAluno(profissionalId, alunoId)
            if (pendente) throw new ConvitePendenteJaExistenteError()

            let codigo = gerarCodigoConvite()

            while (await this.conviteRepository.buscarPorCodigo(codigo)) {
                codigo = gerarCodigoConvite()
            }

            return this.conviteRepository.criar({
                codigo,
                profissionalId,
                alunoId
            })
        })
    }

    private async buscarConviteValido(
        codigo: string,
        alunoId: string
    ): Promise<{
        convite: Convite
        profissional: UserResponse
    }> {
        const convite = await this.conviteRepository.buscarPorCodigo(codigo)

        if (!convite) {
            throw new ConviteNaoEncontradoError()
        }

        if (convite.alunoId !== alunoId) {
            throw new ConviteNaoPertenceAoAlunoError()
        }

        if (convite.status === 'EXPIRADO') throw new ConviteExpiradoError()

        if (convite.status !== 'PENDENTE') {
            throw new ConviteIndisponivelError()
        }

        if (convite.expiraEm.getTime() <= Date.now()) {
            throw new ConviteExpiradoError()
        }

        const profissional = await this.userRepository.findById(
            convite.profissionalId
        )

        if (!profissional || profissional.profile !== 'PROFESSIONAL') {
            throw new ProfissionalNaoEncontradoError()
        }

        return {
            convite,
            profissional: toUserResponse(profissional)
        }
    }

    async buscarConvite(
        codigo: string,
        alunoId: string
    ): Promise<{
        convite: Convite
        profissional: UserResponse
    }> {
        return executarOperacaoVinculo(() => this.buscarConviteValido(codigo, alunoId))
    }

    private async buscarConviteParaAlteracao(
        codigo: string,
        alunoId: string
    ): Promise<Convite> {
        const convite = await this.conviteRepository.buscarPorCodigo(codigo)

        if (!convite) {
            throw new ConviteNaoEncontradoError()
        }

        if (convite.alunoId !== alunoId) {
            throw new ConviteNaoPertenceAoAlunoError()
        }

        if (convite.status === 'EXPIRADO') throw new ConviteExpiradoError()

        if (convite.status !== 'PENDENTE') {
            throw new ConviteIndisponivelError()
        }

        if (convite.expiraEm.getTime() <= Date.now()) {
            const conviteAtualizado = await this.conviteRepository.atualizar({
                ...convite,
                status: 'EXPIRADO'
            })

            if (!conviteAtualizado) {
                throw new Error('Não foi possível atualizar o convite.')
            }

            throw new ConviteExpiradoError()
        }

        return convite
    }

    async aceitarConvite(codigo: string, alunoId: string): Promise<Convite> {
        return executarOperacaoVinculo(async () => {
            const convite = await this.buscarConviteParaAlteracao(codigo, alunoId)

            const profissional = await this.userRepository.findById(convite.profissionalId)
            if (!profissional || profissional.profile !== 'PROFESSIONAL') {
                throw new ProfissionalNaoEncontradoError()
            }

            const aluno = await this.userRepository.findById(alunoId)

            if (!aluno) throw new AlunoNaoEncontradoError()
            if (aluno.profile !== 'STUDENT') throw new UsuarioNaoEhAlunoError()

            if (convite.profissionalId === alunoId) {
                throw new VinculoConsigoMesmoError()
            }

            const vinculos = await this.vinculoRepository.buscarEntreProfissionalEAluno(
                convite.profissionalId,
                alunoId
            )

            if (vinculos.some((vinculo) =>
                vinculo.status === 'PENDENTE' || vinculo.status === 'ATIVO'
            )) {
                throw new VinculoJaExistenteError()
            }


            const vinculoCriado = await this.vinculoRepository.criar({
                profissionalId: convite.profissionalId,
                alunoId,
                status: 'ATIVO'
            })

            try {
                const conviteAtualizado =
                    await this.conviteRepository.atualizar({
                        ...convite,
                        status: 'ACEITO'
                    })

                if (!conviteAtualizado) {
                    throw new Error('Não foi possível atualizar o convite.')
                }

                return conviteAtualizado
            } catch (erro) {
                try {
                    const vinculoRemovido =
                        await this.vinculoRepository.remover(vinculoCriado.id)

                    if (!vinculoRemovido) {
                        throw new Error(
                            'O vínculo criado não foi encontrado para remoção.'
                        )
                    }
                } catch (erroRollback) {
                    throw new FalhaRollbackConviteError(new AggregateError([erro, erroRollback]))
                }

                throw erro
            }

        })
    }

    async recusarConvite(codigo: string, alunoId: string): Promise<Convite> {
        return executarOperacaoVinculo(async () => {
            const convite = await this.buscarConviteParaAlteracao(codigo, alunoId)

            const aluno = await this.userRepository.findById(alunoId)

            if (!aluno) throw new AlunoNaoEncontradoError()
            if (aluno.profile !== 'STUDENT') throw new UsuarioNaoEhAlunoError()

            const conviteAtualizado = await this.conviteRepository.atualizar({
                ...convite,
                status: 'RECUSADO'
            })

            if (!conviteAtualizado) {
                throw new Error('Não foi possível atualizar o convite.')
            }

            return conviteAtualizado
        })
    }
}
