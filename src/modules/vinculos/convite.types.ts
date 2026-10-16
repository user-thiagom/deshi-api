
export type StatusConvite = 'PENDENTE' | 'ACEITO' | 'RECUSADO' | 'EXPIRADO'

export interface Convite {
    id: string
    codigo: string
    profissionalId: string
    status: StatusConvite
    criadoEm: Date
    expiraEm: Date
}

export type DadosCriacaoConvite = {
    codigo: string
    profissionalId: string
}
