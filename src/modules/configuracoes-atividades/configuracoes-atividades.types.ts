export const METRICAS = {
    series: { tipo: 'inteiro', unidade: 'series', min: 1 },
    repeticoes: { tipo: 'inteiro', unidade: 'repeticoes', min: 1 },
    cargaKg: { tipo: 'decimal', unidade: 'kg', min: 0 },
    duracaoSegundos: { tipo: 'duracao', unidade: 's', min: 1 },
    quantidade: { tipo: 'inteiro', unidade: 'unidades', min: 1 },
    descansoSegundos: { tipo: 'duracao', unidade: 's', min: 0 },
    distanciaMetros: { tipo: 'decimal', unidade: 'm', min: 0.01 },
    rounds: { tipo: 'inteiro', unidade: 'rounds', min: 1 },
    duracaoRoundSegundos: { tipo: 'duracao', unidade: 's', min: 1 }
} as const

export type ChaveMetrica = keyof typeof METRICAS
export type TipoCampo = 'inteiro' | 'decimal' | 'duracao'

export interface CampoConfiguracao {
    chave: ChaveMetrica
    tipo: TipoCampo
    obrigatorio: boolean
    unidade?: string
    min?: number
    max?: number
}

export interface CamposAtividade {
    atividadeId: string
    campos: CampoConfiguracao[]
}

export interface ConfiguracaoAtividade {
    id: string
    atividadeId: string
    profissionalId: string
    valores: Partial<Record<ChaveMetrica, number>>
    criadoEm: string
    atualizadoEm: string
}
