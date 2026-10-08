import { TokenRevocationRepository } from "./token-revocation.repository.js"
import { promises as fs } from 'node:fs'

type RevokedToken = {
    jti: string
    expiresAt: Date
}

export class JsonTokenRevocationRepository implements TokenRevocationRepository {
    constructor(private readonly filePath: string) { }

    private async readTokens(): Promise<RevokedToken[]> {
        const content = await fs.readFile(this.filePath, 'utf-8')
        const tokens = JSON.parse(content)

        return tokens.map((token: RevokedToken) => ({
            ...token,
            expiresAt: new Date(token.expiresAt)
        }))
    }

    private async writeTokens(tokens: RevokedToken[]): Promise<void> {
        const data = JSON.stringify(tokens, null, 2)
        await fs.writeFile(this.filePath, data)
    }

    private removeExpiredTokens(tokens: RevokedToken[]): RevokedToken[] {
        const now = new Date()

        return tokens.filter((token) => token.expiresAt > now)
    }

    async revoke(jti: string, expiresAt: Date): Promise<void> {
        const tokens = await this.readTokens()
        const activeTokens = this.removeExpiredTokens(tokens)

        const alreadyRevoked = activeTokens.some(
            (token) => token.jti === jti
        )

        if (alreadyRevoked) {
            return
        }

        activeTokens.push({
            jti,
            expiresAt
        })

        await this.writeTokens(activeTokens)
    }

    async isRevoked(jti: string): Promise<boolean> {
        const tokens = await this.readTokens()
        const activeTokens = this.removeExpiredTokens(tokens)

        await this.writeTokens(activeTokens)

        return activeTokens.some((token) => token.jti === jti)
    }
}