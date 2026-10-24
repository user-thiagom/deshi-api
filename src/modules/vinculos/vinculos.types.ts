export type StatusVinculo = 'PENDENTE' | 'ATIVO' | 'RECUSADO'

export interface Vinculo {
    id: string
    profissionalId: string
    alunoId: string
    status: StatusVinculo
    criadoEm: Date
    atualizadoEm: Date
}

export type DadosCriacaoVinculo = {
    profissionalId: string
    alunoId: string
    status: StatusVinculo
}

export type RespostaVinculo = {
    id: string
    profissionalId: string
    alunoId: string
    status: StatusVinculo
    criadoEm: Date
    atualizadoEm: Date
}
