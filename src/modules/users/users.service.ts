import { UserRepository } from './repositories/user.repository.js'
import { CreateUserBody } from './users.schema.js';

export class UserService {
    constructor(private readonly userRepository: UserRepository) {}

    async createUser(data: CreateUserBody) {
        return data
    }
}