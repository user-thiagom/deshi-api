export class ProgramResourceNotFoundError extends Error {
    constructor(message = 'Recurso não encontrado.') {
        super(message)
        this.name = 'ProgramResourceNotFoundError'
    }
}

export class StudentNotLinkedError extends Error {
    constructor() {
        super('O aluno não está vinculado a este profissional.')
        this.name = 'StudentNotLinkedError'
    }
}

export class ProgramAccessDeniedError extends Error {
    constructor() {
        super('Você não tem permissão para acessar este recurso.')
        this.name = 'ProgramAccessDeniedError'
    }
}

export class ProgramNotOwnedError extends Error {
    constructor() {
        super('Você não tem permissão para alterar este programa.')
        this.name = 'ProgramNotOwnedError'
    }
}

export class InvalidProgramDataError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'InvalidProgramDataError'
    }
}