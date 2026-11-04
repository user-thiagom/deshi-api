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