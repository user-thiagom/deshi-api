export class ConfiguracaoError extends Error {
    constructor(public readonly statusCode: 400 | 403 | 404 | 409, message: string) {
        super(message)
        this.name = 'ConfiguracaoError'
    }
}
