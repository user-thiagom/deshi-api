import { promises as fs } from 'node:fs'
import { UserRepository } from './user.repository.js'
import { CreateUserData, User } from '../users.types.js'

export class JsonUserRepository implements UserRepository {
    async create(data: CreateUserData): Promise<User> {
        throw new Error('Not implemented')
    }

    async findByEmail(email: string): Promise<User | null> {
        throw new Error('Not implemented')
    }

    async findById(id: string): Promise<User | null> {
        throw new Error('Not implemented')
    }
}