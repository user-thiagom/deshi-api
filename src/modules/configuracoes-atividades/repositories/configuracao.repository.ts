import { ConfiguracaoAtividade } from '../configuracoes-atividades.types.js'

export interface ConfiguracaoRepository {
    listar(): Promise<ConfiguracaoAtividade[]>
    buscarPorId(id: string): Promise<ConfiguracaoAtividade | null>
    criar(configuracao: ConfiguracaoAtividade): Promise<void>
}
