import { LoginResponse, User, UserResponse } from "./users.types.js";

export function toUserResponse(user: User): UserResponse {
    const response: UserResponse = {
        id: user.id,
        name: user.name,
        email: user.email,
        profile: user.profile,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
    }

    return response
}

export function toLoginResponse(user: User, token: string): LoginResponse {
    return {
        token,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            profile: user.profile,
            birthDate: user.birthDate?.toISOString().slice(0, 10) ?? null,
            gender: user.gender ?? null
        }
    }
}
