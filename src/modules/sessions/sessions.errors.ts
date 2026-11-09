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

export class SessionNotFoundError extends Error {
  constructor() {
    super('Sessão não encontrada.')
    this.name = 'SessionNotFoundError'
  }
}

export class SessionNotOwnedByStudentError extends Error {
  constructor() {
    super('Esta sessão não pertence ao aluno autenticado.')
    this.name = 'SessionNotOwnedByStudentError'
  }
}

export class SessionNotOwnedByProfessionalError extends Error {
  constructor() {
    super('Esta sessão não pertence ao profissional autenticado.')
    this.name = 'SessionNotOwnedByProfessionalError'
  }
}

export class SessionActivityNotFoundError extends Error {
  constructor() {
    super('Atividade não encontrada nesta sessão.')
    this.name = 'SessionActivityNotFoundError'
  }
}

export class InvalidActivityStateError extends Error {
  constructor(message = 'A atividade não pode realizar esta operação no estado atual.') {
    super(message)
    this.name = 'InvalidActivityStateError'
  }
}
