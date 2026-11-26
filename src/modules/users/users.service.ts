import bcrypt from 'bcryptjs';
import { UserRepository } from './repositories/user.repository.js'
import { CreateUserBody, LoginBody } from './users.schema.js';
import { CreateUserData, LoginResponse } from './users.types.js';
import { EmailAlreadyExistsError, InvalidCredentialsError, InvalidCurrentPasswordError, ProfileFieldAlreadySetError, UserProfileNotFoundError } from './users.errors.js';
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
            profile: data.profile,
            birthDate: new Date(`${data.birthDate}T00:00:00.000Z`),
            gender: data.gender
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

    async updateStudentProfile(userId: string, data: import('./users.schema.js').UpdateStudentProfileBody) {
        const existingUser = await this.userRepository.findById(userId)
        if (!existingUser || existingUser.profile !== 'STUDENT') throw new UserProfileNotFoundError()
        if (data.birthDate && existingUser.birthDate) throw new ProfileFieldAlreadySetError('data de nascimento')
        if (data.gender && existingUser.gender) throw new ProfileFieldAlreadySetError('gênero')

        const user = await this.userRepository.updateStudentProfile(userId, {
            ...(data.name === undefined ? {} : { name: data.name }),
            ...(data.birthDate === undefined ? {} : { birthDate: new Date(`${data.birthDate}T00:00:00.000Z`) }),
            ...(data.gender === undefined ? {} : { gender: data.gender }),
        })
        if (!user) throw new ProfileFieldAlreadySetError('perfil')
        return user
    }

    async changeStudentPassword(userId: string, currentPassword: string, newPassword: string) {
        const user = await this.userRepository.findById(userId)
        if (!user || user.profile !== 'STUDENT') throw new UserProfileNotFoundError()
        if (!await bcrypt.compare(currentPassword, user.passwordHash)) throw new InvalidCurrentPasswordError()
        const passwordHash = await bcrypt.hash(newPassword, 10)
        const updated = await this.userRepository.updatePasswordHash(userId, passwordHash)
        if (!updated) throw new UserProfileNotFoundError()
    }
}
