export class ConviteError extends Error {
    constructor(message: string, readonly statusCode: 403 | 404 | 409 | 410) {
        super(message)
        this.name = new.target.name
    }
}

export class ConviteNaoEncontradoError extends ConviteError {
    constructor() { super('Convite não encontrado.', 404) }
}

export class ProfissionalNaoEncontradoError extends ConviteError {
    constructor() { super('Profissional não encontrado.', 404) }
}

export class ConviteNaoPertenceAoAlunoError extends ConviteError {
    constructor() { super('Este convite não pertence a este aluno.', 403) }
}

export class ConviteIndisponivelError extends ConviteError {
    constructor() { super('Este convite não está mais disponível.', 409) }
}

export class ConviteExpiradoError extends ConviteError {
    constructor() { super('Este convite expirou.', 410) }
}

export class ConvitePendenteJaExistenteError extends ConviteError {
    constructor() { super('Já existe um convite pendente para este profissional e aluno.', 409) }
}

export class FalhaRollbackConviteError extends Error {
    constructor(cause: unknown) {
        super('Não foi possível atualizar o convite nem desfazer a criação do vínculo. É necessária uma verificação manual.', { cause })
        this.name = 'FalhaRollbackConviteError'
    }
}
