import bcrypt from 'bcryptjs';
import { UserRepository } from './repositories/user.repository.js'
import { CreateUserBody } from './users.schema.js';
import { CreateUserData } from './users.types.js';
import { EmailAlreadyExistsError } from './users.errors.js';

export class UserService {
    constructor(private readonly userRepository: UserRepository) { }

    async createUser(data: CreateUserBody) {
        const userFound = await this.userRepository.findByEmail(data.email)

        if (userFound) {
            throw new EmailAlreadyExistsError()
        }

        const userData: CreateUserData = {
            name: data.name,
            email: data.email,
            passwordHash: await bcrypt.hash(data.password, 10),
            profile: data.profile
        }

        const user = await this.userRepository.create(userData)

        return user
    }
}