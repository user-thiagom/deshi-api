import { randomUUID } from 'node:crypto'
import { ModalidadeRepository } from '../modalidades/repositories/modalidade.repository.js'
import { AtividadeRepository } from './repositories/atividade.repository.js'
import { ModalidadeDaAtividadeNaoEncontradaError } from './atividades.errors.js'
import { AtualizarAtividadeBody, CriarAtividadeBody, ListarAtividadesQuery } from './atividades.schema.js'
import { Atividade } from './atividades.types.js'

export class AtividadeService {
    constructor(
        private readonly atividadeRepository: AtividadeRepository,
        private readonly modalidadeRepository: Pick<ModalidadeRepository, 'listarCatalogo'>
    ) { }

    private async validarModalidade(modalidadeId: string): Promise<void> {
        const modalidades = await this.modalidadeRepository.listarCatalogo()
        if (!modalidades.some((modalidade) => modalidade.id === modalidadeId)) {
            throw new ModalidadeDaAtividadeNaoEncontradaError()
        }
    }

    async listar(profissionalId: string, filtros: ListarAtividadesQuery): Promise<Atividade[]> {
        if (filtros.modalidadeId) {
            await this.validarModalidade(filtros.modalidadeId)
        }

        const atividades = await this.atividadeRepository.listar()
        const busca = filtros.busca?.toLocaleLowerCase('pt-BR')
        return atividades.filter((atividade) =>
            (atividade.origem === 'PADRAO' ||
                (atividade.origem === 'PERSONALIZADA' && atividade.profissionalId === profissionalId)) &&
            (!busca || atividade.nome.toLocaleLowerCase('pt-BR').includes(busca)) &&
            (!filtros.modalidadeId || atividade.modalidadeId === filtros.modalidadeId)
        )
    }

    async criar(profissionalId: string, dados: CriarAtividadeBody): Promise<Atividade> {
        await this.validarModalidade(dados.modalidadeId)
        const atividade: Atividade = {
            id: randomUUID(),
            nome: dados.nome,
            modalidadeId: dados.modalidadeId,
            ...(dados.descricao !== undefined ? { descricao: dados.descricao } : {}),
            ...(dados.midiaUrl !== undefined ? { midiaUrl: dados.midiaUrl } : {}),
            ...(dados.grupoMuscular !== undefined ? { grupoMuscular: dados.grupoMuscular } : {}),
            origem: 'PERSONALIZADA',
            profissionalId
        }
        await this.atividadeRepository.criar(atividade)
        return atividade
    }

    async atualizar(profissionalId: string, atividadeId: string, dados: AtualizarAtividadeBody): Promise<Atividade | null> {
        const existente = (await this.atividadeRepository.listar()).find((atividade) => atividade.id === atividadeId)
        if (!existente || existente.origem !== 'PERSONALIZADA' || existente.profissionalId !== profissionalId) return null
        await this.validarModalidade(dados.modalidadeId)

        const atividade: Atividade = {
            id: existente.id,
            nome: dados.nome,
            modalidadeId: dados.modalidadeId,
            ...(dados.descricao ? { descricao: dados.descricao } : {}),
            ...(dados.midiaUrl ? { midiaUrl: dados.midiaUrl } : {}),
            ...(dados.grupoMuscular ? { grupoMuscular: dados.grupoMuscular } : {}),
            origem: 'PERSONALIZADA',
            profissionalId
        }
        const atualizada = await this.atividadeRepository.atualizar(atividade)
        return atualizada ? atividade : null
    }
}
