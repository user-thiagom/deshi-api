import { CreateUserData, StudentBodyMetrics, StudentBodyMetricsInput, User } from '../users.types.js'

export interface UserRepository {
    create(data: CreateUserData): Promise<User>
    findByEmail(email: string): Promise<User | null>
    findById(id: string): Promise<User | null>
}

export interface StudentBodyMetricsRepository {
    findBodyMetricsByStudentId(studentId: string): Promise<StudentBodyMetrics | null>
    updateBodyMetricsByStudentId(studentId: string, metrics: StudentBodyMetricsInput): Promise<StudentBodyMetrics | null>
}
