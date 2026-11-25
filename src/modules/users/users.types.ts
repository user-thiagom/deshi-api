export type UserProfile = 'PROFESSIONAL' | 'STUDENT'

export interface User {
    id: string
    name: string
    email: string
    passwordHash: string
    profile: UserProfile
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

export type StudentBodyMetrics = StudentBodyMetricsInput & {
    bmi: number
    updatedAt: Date
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
    }
}
