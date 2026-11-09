import { CamposAtividade } from '../configuracoes-atividades.types.js'

export interface CamposRepository {
    buscarPorAtividade(atividadeId: string): Promise<CamposAtividade | null>
    criarPersonalizada(definicao: CamposAtividade): Promise<void>
}
