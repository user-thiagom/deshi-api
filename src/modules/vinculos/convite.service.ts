
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
    private operacoesPendentes: Promise<void> = Promise.resolve()

    constructor(
        private readonly conviteRepository: ConviteRepository,
        private readonly vinculoRepository: VinculoRepository,
        private readonly userRepository: UserRepository
    ) { }

    private executarEmSequencia<T>(operacao: () => Promise<T>): Promise<T> {
        const resultado = this.operacoesPendentes.then(operacao)

        this.operacoesPendentes = resultado.then(
            () => undefined,
            () => undefined
        )

        return resultado
    }

    async criarConvite(
        profissionalId: string,
        alunoId: string
    ): Promise<Convite> {
        return this.executarEmSequencia(async () => {
            const profissional = await this.userRepository.findById(profissionalId)

            if (!profissional || profissional.profile !== 'PROFESSIONAL') {
                throw new Error('Profissional não encontrado.')
            }

            const aluno = await this.userRepository.findById(alunoId)

            if (!aluno || aluno.profile !== 'STUDENT') {
                throw new Error('Aluno não encontrado.')
            }

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
            throw new Error('Convite não encontrado.')
        }

        if (convite.alunoId !== alunoId) {
            throw new Error('Este convite não pertence a este aluno.')
        }

        if (convite.status !== 'PENDENTE') {
            throw new Error('Este convite não está mais disponível.')
        }

        if (convite.expiraEm.getTime() <= Date.now()) {
            throw new Error('Este convite expirou.')
        }

        const profissional = await this.userRepository.findById(
            convite.profissionalId
        )

        if (!profissional || profissional.profile !== 'PROFESSIONAL') {
            throw new Error('Profissional não encontrado.')
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
        return this.buscarConviteValido(codigo, alunoId)
    }

    private async buscarConviteParaAlteracao(
        codigo: string,
        alunoId: string
    ): Promise<Convite> {
        const convite = await this.conviteRepository.buscarPorCodigo(codigo)

        if (!convite) {
            throw new Error('Convite não encontrado.')
        }

        if (convite.alunoId !== alunoId) {
            throw new Error('Este convite não pertence a este aluno.')
        }

        if (convite.status !== 'PENDENTE') {
            throw new Error('Este convite não está mais disponível.')
        }

        if (convite.expiraEm.getTime() <= Date.now()) {
            const conviteAtualizado = await this.conviteRepository.atualizar({
                ...convite,
                status: 'EXPIRADO'
            })

            if (!conviteAtualizado) {
                throw new Error('Não foi possível atualizar o convite.')
            }

            throw new Error('Este convite expirou.')
        }

        return convite
    }

    async aceitarConvite(codigo: string, alunoId: string): Promise<Convite> {
        return this.executarEmSequencia(async () => {
            const convite = await this.buscarConviteParaAlteracao(codigo, alunoId)

            const aluno = await this.userRepository.findById(alunoId)

            if (!aluno || aluno.profile !== 'STUDENT') {
                throw new Error('Aluno não encontrado.')
            }

            if (convite.profissionalId === alunoId) {
                throw new Error('Não é possível criar vínculo consigo mesmo.')
            }

            const vinculos = await this.vinculoRepository.buscarEntreProfissionalEAluno(
                convite.profissionalId,
                alunoId
            )

            if (vinculos.some((vinculo) =>
                vinculo.status === 'PENDENTE' || vinculo.status === 'ATIVO'
            )) {
                throw new Error('Já existe uma solicitação ou vínculo para este aluno.')
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
                } catch {
                    throw new Error(
                        'Não foi possível atualizar o convite nem desfazer a criação do vínculo. É necessária uma verificação manual.'
                    )
                }

                throw erro
            }

        })
    }

    async recusarConvite(codigo: string, alunoId: string): Promise<Convite> {
        return this.executarEmSequencia(async () => {
            const convite = await this.buscarConviteParaAlteracao(codigo, alunoId)

            const aluno = await this.userRepository.findById(alunoId)

            if (!aluno || aluno.profile !== 'STUDENT') {
                throw new Error('Aluno não encontrado.')
            }

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
