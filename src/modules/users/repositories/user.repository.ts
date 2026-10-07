import { CreateUserData, User } from '../users.types.js'

export interface UserRepository {
    create(data: CreateUserData): Promise<User>
    findByEmail(email: string): Promise<User | null>
    findById(id: string): Promise<User | null>
}