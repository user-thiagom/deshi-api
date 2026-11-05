import bcrypt from 'bcryptjs';
import { UserRepository } from './repositories/user.repository.js'
import { CreateUserBody, LoginBody } from './users.schema.js';
import { CreateUserData, LoginResponse } from './users.types.js';
import { EmailAlreadyExistsError, InvalidCredentialsError } from './users.errors.js';
import jwt from 'jsonwebtoken'
import { toLoginResponse } from './users.mapper.js';
import { randomUUID } from 'node:crypto';

export class UserService {
    constructor(private readonly userRepository: UserRepository, private readonly jwtsecret: string) { }

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

    async login(data: LoginBody) {
        const user = await this.userRepository.findByEmail(data.email)

        if (!user) {
            throw new InvalidCredentialsError()
        }

        const isValidPassword = await bcrypt.compare(data.password, user.passwordHash)

        if (!isValidPassword) {
            throw new InvalidCredentialsError()
        }

        const token = jwt.sign(
            { userId: user.id },
            this.jwtsecret,
            {
                expiresIn: '1h',
                jwtid: randomUUID()
            }
        )

        return {
            token,
            user
        }
    }
}