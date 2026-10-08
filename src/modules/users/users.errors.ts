export class EmailAlreadyExistsError extends Error {
    constructor() {
        super('E-mail já cadastrado.')
        this.name = 'EmailAlreadyExistsError'
    }
}

export class InvalidCredentialsError extends Error {
    constructor() {
        super('E-mail ou senha inválidos.')
        this.name = 'InvalidCredentialsError'
    }
}