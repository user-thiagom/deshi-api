export class ModalidadeNaoEncontradaError extends Error {
    constructor() {
        super('Uma ou mais modalidades informadas não existem.')
        this.name = 'ModalidadeNaoEncontradaError'
    }
}
