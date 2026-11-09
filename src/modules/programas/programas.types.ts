
export interface AtividadeDoPrograma {
    atividadeId: string
    ordem: number
    valores: Record<string, number>
}

export interface Programa {
    id: string
    profissionalId: string
    alunoId: string
    modalidadeId: string
    nome: string
    atividades: AtividadeDoPrograma[]
    criadoEm: string
    atualizadoEm: string
}
