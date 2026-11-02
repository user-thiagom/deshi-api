export class AlunoNaoEncontradoError extends Error {
    constructor() {
        super('Aluno não encontrado.')
        this.name = 'AlunoNaoEncontradoError'
    }
}

export class UsuarioNaoEhAlunoError extends Error {
    constructor() {
        super('O usuário informado não possui perfil de aluno.')
        this.name = 'UsuarioNaoEhAlunoError'
    }
}

export class VinculoConsigoMesmoError extends Error {
    constructor() {
        super('O profissional não pode solicitar vínculo consigo mesmo.')
        this.name = 'VinculoConsigoMesmoError'
    }
}

export class VinculoJaExistenteError extends Error {
    constructor() {
        super('Já existe um vínculo pendente ou ativo entre este profissional e aluno.')
        this.name = 'VinculoJaExistenteError'
    }
}

export class VinculoNaoEncontradoError extends Error {
    constructor() {
        super('Vínculo não encontrado.')
        this.name = 'VinculoNaoEncontradoError'
    }
}

export class SolicitacaoNaoPertenceAoAlunoError extends Error {
    constructor() {
        super('A solicitação não pertence ao aluno autenticado.')
        this.name = 'SolicitacaoNaoPertenceAoAlunoError'
    }
}

export class VinculoNaoEstaPendenteError extends Error {
    constructor() {
        super('O vínculo não está pendente.')
        this.name = 'VinculoNaoEstaPendenteError'
    }
}
