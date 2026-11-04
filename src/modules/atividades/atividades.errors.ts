export class ModalidadeDaAtividadeNaoEncontradaError extends Error {
    constructor() {
        super('A modalidade informada não existe.')
        this.name = 'ModalidadeDaAtividadeNaoEncontradaError'
    }
}
