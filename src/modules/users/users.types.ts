export type UserProfile = 'PROFESSIONAL' | 'STUDENT'
export type UserGender = 'MALE' | 'FEMALE'

export interface User {
    id: string
    name: string
    email: string
    passwordHash: string
    profile: UserProfile
    birthDate?: Date | null
    gender?: UserGender | null
    weightKg?: number | null
    heightCm?: number | null
    bodyMetricsUpdatedAt?: Date | null
    createdAt: Date
    updatedAt: Date
}

export type StudentBodyMetricsInput = {
    weightKg: number
    heightCm: number
}

export type StudentProfileUpdate = {
    name?: string
    birthDate?: Date
    gender?: UserGender
}

export type StudentBodyMetrics = StudentBodyMetricsInput & {
    bmi: number
    updatedAt: Date
    birthDate?: Date | null
    gender?: UserGender | null
    history: StudentWeightRecord[]
}

export type StudentWeightRecord = StudentBodyMetricsInput & {
    id: string
    bmi: number
    recordedAt: Date
}

export type CreateUserData = {
    name: string
    email: string
    passwordHash: string
    profile: UserProfile
    birthDate: Date
    gender: UserGender
}

export type UserResponse = {
    id: string
    name: string
    email: string
    profile: UserProfile
    createdAt: Date
    updatedAt: Date
}

export type LoginResponse = {
    token: string
    user: {
        id: string
        name: string
        email: string
        profile: UserProfile
        birthDate: string | null
        gender: UserGender | null
    }
}
