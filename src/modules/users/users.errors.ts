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

export class InvalidCurrentPasswordError extends Error {
    constructor() {
        super('A senha atual está incorreta.')
        this.name = 'InvalidCurrentPasswordError'
    }
}

export class UserProfileNotFoundError extends Error {
    constructor() {
        super('Perfil de aluno não encontrado.')
        this.name = 'UserProfileNotFoundError'
    }
}

export class ProfileFieldAlreadySetError extends Error {
    constructor(field: string) {
        super(`O campo ${field} já está cadastrado.`)
        this.name = 'ProfileFieldAlreadySetError'
    }
}
