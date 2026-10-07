import { promises as fs } from 'node:fs'
import { UserRepository } from './user.repository.js'
import { CreateUserData, User } from '../users.types.js'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export class JsonUserRepository implements UserRepository {
    constructor(private readonly filePath: string) { }

    private async readUsers(): Promise<User[]> {
        const content = await fs.readFile(this.filePath, 'utf-8')
        const users = JSON.parse(content)
        return users
    }

    private async writeUsers(users: User[]): Promise<void> {
        const data = JSON.stringify(users, null, 2) //O null, 2 serve para deixar o JSON formatado/indentado, facilitando a leitura humana.
        await fs.writeFile(this.filePath, data)
    }

    async create(data: CreateUserData): Promise<User> {
        const now = new Date()

        const user: User = {
            id: randomUUID(),
            ...data,
            createdAt: now,
            updatedAt: now
        }

        const users = await this.readUsers()
        users.push(user)
        await this.writeUsers(users)

        return user
    }

    async findByEmail(email: string): Promise<User | null> {
        const users = await this.readUsers()
        const user = users.find((user) => user.email === email)
        return user ? user : null
    }

    async findById(id: string): Promise<User | null> {
        const users = await this.readUsers()
        const user = users.find((user) => user.id === id)
        return user ?? null
    }
}