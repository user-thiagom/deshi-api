import { randomUUID } from 'node:crypto'
import { UserRepository } from '../users/repositories/user.repository.js'
import { toUserResponse } from '../users/users.mapper.js'
import { UserResponse } from '../users/users.types.js'
import { VinculoRepository } from './repositories/vinculo.repository.js'
import { ConviteRepository } from './repositories/convite.repository.js'
import { Convite } from './convite.types.js'

export class ConviteService {
    private operacoesPendentes: Promise<void> = Promise.resolve()

    constructor(
        private readonly conviteRepository: ConviteRepository,
        private readonly vinculoRepository: VinculoRepository,
        private readonly userRepository: UserRepository
    ) {}

    private executarEmSequencia<T>(operacao: () => Promise<T>): Promise<T> {
        const resultado = this.operacoesPendentes.then(operacao)
        this.operacoesPendentes = resultado.then(
            () => undefined,
            () => undefined
        )
        return resultado
    }

    async criarConvite(profissionalId: string): Promise<Convite> {
        return this.executarEmSequencia(async () => {
            const profissional = await this.userRepository.findById(profissionalId)

            if (!profissional || profissional.profile !== 'PROFESSIONAL') {
                throw new Error('Profissional não encontrado.')
            }

            return this.conviteRepository.criar({
                codigo: randomUUID(),
                profissionalId
            })
        })
    }

    async buscarConvite(codigo: string): Promise<{
        convite: Convite
        profissional: UserResponse
    }> {
        const convite = await this.conviteRepository.buscarPorCodigo(codigo)

        if (!convite) {
            throw new Error('Convite não encontrado.')
        }

        if (convite.status !== 'PENDENTE') {
            throw new Error('Este convite não está mais disponível.')
        }

        if (convite.expiraEm.getTime() <= Date.now()) {
            await this.conviteRepository.atualizar({
                ...convite,
                status: 'EXPIRADO'
            })
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

    async aceitarConvite(codigo: string, alunoId: string): Promise<Convite> {
        return this.executarEmSequencia(async () => {
            const { convite } = await this.buscarConvite(codigo)

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

            await this.vinculoRepository.criar({
                profissionalId: convite.profissionalId,
                alunoId,
                status: 'ATIVO'
            })

            const conviteAtualizado = await this.conviteRepository.atualizar({
                ...convite,
                status: 'ACEITO'
            })

            if (!conviteAtualizado) {
                throw new Error('Não foi possível atualizar o convite.')
            }

            return conviteAtualizado
        })
    }

    async recusarConvite(codigo: string, alunoId: string): Promise<Convite> {
    return this.executarEmSequencia(async () => {
        const { convite } = await this.buscarConvite(codigo)

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