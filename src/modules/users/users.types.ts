export type UserProfile = 'PROFESSIONAL' | 'STUDENT'

export interface User {
    id: string
    name: string
    email: string
    passwordHash: string
    profile: UserProfile
    createdAt: Date
    updatedAt: Date
}

export type CreateUserData = {
    name: string
    email: string
    passwordHash: string
    profile: UserProfile
}