export class ProgramNotFoundError extends Error {
    constructor() {
        super('Programa não encontrado.')
        this.name = 'ProgramNotFoundError'
    }
}

export class ProgramNotOwnedByStudentError extends Error {
    constructor() {
        super('Este programa não pertence ao aluno autenticado.')
        this.name = 'ProgramNotOwnedByStudentError'
    }
}