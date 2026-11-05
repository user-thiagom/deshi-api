import { RespostaVinculo, Vinculo } from './vinculos.types.js'

export function paraRespostaVinculo(vinculo: Vinculo): RespostaVinculo {
    return {
        id: vinculo.id,
        profissionalId: vinculo.profissionalId,
        alunoId: vinculo.alunoId,
        status: vinculo.status,
        criadoEm: vinculo.criadoEm,
        atualizadoEm: vinculo.atualizadoEm
    }
}
