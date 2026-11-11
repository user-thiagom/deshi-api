import { promises as fs } from 'node:fs'
import { UserRepository } from './user.repository.js'
import { CreateUserData, User } from '../users.types.js'
import { randomUUID } from 'node:crypto'

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

    async findByIds(ids: string[]): Promise<Array<User | null>> {
        if (ids.length === 0) return []

        const idsToFind = new Set(ids)
        const users = await this.readUsers()
        const usersById = new Map<string, User>()

        for (const user of users) {
            if (idsToFind.has(user.id) && !usersById.has(user.id)) {
                usersById.set(user.id, user)
            }
        }

        return ids.map((id) => usersById.get(id) ?? null)
    }
}
