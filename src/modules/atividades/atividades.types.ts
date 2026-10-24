interface AtividadeBase {
    id: string
    nome: string
    descricao?: string
    midiaUrl?: string
    modalidadeId: string
}

export type Atividade = AtividadeBase & (
    | { origem: 'PADRAO'; profissionalId: null }
    | { origem: 'PERSONALIZADA'; profissionalId: string }
)
