import { resolve } from 'node:path'

// Coordena convites e vínculos, inclusive entre instâncias, no mesmo processo.
// A fila de negócio cobre consulta, gravação e eventual rollback como uma operação.
let operacaoPendente: Promise<void> = Promise.resolve()

export function executarOperacaoVinculo<T>(operacao: () => Promise<T>): Promise<T> {
    const resultado = operacaoPendente.then(operacao)
    operacaoPendente = resultado.then(() => undefined, () => undefined)
    return resultado
}

// Separada da fila de negócio para permitir que os serviços chamem os repositórios.
const gravacoesPendentes = new Map<string, Promise<void>>()

export function executarGravacaoJson<T>(caminho: string, operacao: () => Promise<T>): Promise<T> {
    const chave = resolve(caminho)
    const resultado = (gravacoesPendentes.get(chave) ?? Promise.resolve()).then(operacao)
    const pendente = resultado.then(() => undefined, () => undefined)
    gravacoesPendentes.set(chave, pendente)
    void pendente.then(() => {
        if (gravacoesPendentes.get(chave) === pendente) gravacoesPendentes.delete(chave)
    })
    return resultado
}
