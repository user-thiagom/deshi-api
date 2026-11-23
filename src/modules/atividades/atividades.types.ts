interface AtividadeBase {
    id: string
    nome: string
    descricao?: string
    midiaUrl?: string
    grupoMuscular?: string
    modalidadeId: string
}

export type Atividade = AtividadeBase & (
    | { origem: 'PADRAO'; profissionalId: null }
    | { origem: 'PERSONALIZADA'; profissionalId: string }
)
