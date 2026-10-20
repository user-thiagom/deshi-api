import { promises as fs } from 'node:fs'
import { CatalogActivity } from '../program.types.js'
import { ProgramCatalogRepository } from './program-catalog.repository.js'

interface VinculoRecord {
    id: string
    profissionalId: string
    alunoId: string
    status: string
}

interface ModalidadeRecord {
    id: string
    nome: string
}

interface SelecaoModalidadesRecord {
    profissionalId: string
    modalidadeIds: string[]
}

export class JsonProgramCatalogRepository implements ProgramCatalogRepository {
    constructor(
        private readonly vinculosPath: string,
        private readonly modalidadesPath: string,
        private readonly selecoesModalidadesPath: string,
        private readonly atividadesPath: string,
        private readonly atividadesPersonalizadasPath: string
    ) { }

    private async readJson<T>(filePath: string): Promise<T> {
        const content = await fs.readFile(filePath, 'utf-8')
        return JSON.parse(content) as T
    }

    async findActiveStudentLink(professionalId: string, linkId: string) {
        const vinculos = await this.readJson<VinculoRecord[]>(this.vinculosPath)
        const vinculo = vinculos.find(
            (item) => item.id === linkId &&
                item.profissionalId === professionalId && item.status === 'ATIVO'
        )
        return vinculo ? { studentId: vinculo.alunoId } : null
    }

    async hasProfessionalModality(professionalId: string, modalityId: string): Promise<boolean> {
        const [modalidades, selecoes] = await Promise.all([
            this.readJson<ModalidadeRecord[]>(this.modalidadesPath),
            this.readJson<SelecaoModalidadesRecord[]>(this.selecoesModalidadesPath)
        ])
        const modalityExists = modalidades.some((modality) => modality.id === modalityId)
        const selectedIds = selecoes.find((selection) => selection.profissionalId === professionalId)?.modalidadeIds ?? []
        return modalityExists && selectedIds.includes(modalityId)
    }

    async findActivity(activityId: string): Promise<CatalogActivity | null> {
        const [standardActivities, customActivities] = await Promise.all([
            this.readJson<CatalogActivity[]>(this.atividadesPath),
            this.readJson<CatalogActivity[]>(this.atividadesPersonalizadasPath)
        ])
        return [...standardActivities, ...customActivities].find((activity) => activity.id === activityId) ?? null
    }
}