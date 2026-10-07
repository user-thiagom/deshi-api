export interface CreateUserBody {
    name: string
    email: string
    password: string
    profile: 'PROFESSIONAL' | 'STUDENT'
}