import { CreateUserData, StudentBodyMetrics, StudentBodyMetricsInput, StudentProfileUpdate, User } from '../users.types.js'

export interface UserRepository {
    create(data: CreateUserData): Promise<User>
    findByEmail(email: string): Promise<User | null>
    findById(id: string): Promise<User | null>
    updateStudentProfile(id: string, data: StudentProfileUpdate): Promise<User | null>
    updatePasswordHash(id: string, passwordHash: string): Promise<boolean>
}

export interface StudentBodyMetricsRepository {
    findBodyMetricsByStudentId(studentId: string): Promise<StudentBodyMetrics | null>
    updateBodyMetricsByStudentId(studentId: string, metrics: StudentBodyMetricsInput): Promise<StudentBodyMetrics | null>
}
