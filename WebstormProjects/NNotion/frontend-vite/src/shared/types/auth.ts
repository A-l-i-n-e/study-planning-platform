import type { UserRole } from './user';

export interface LoginRequest {
    email: string;
    password: string;
}

export interface RoleLoginRequest {
    role: UserRole;
}

export interface UserLoginRequest {
    userId: number;
}

export interface LoginUserOption extends AuthUser {
    createdAt?: string;
    group?: {
        id: number;
        name: string;
        description?: string | null;
        teacherId?: number | null;
    } | null;
}

export interface RegisterRequest {
    name: string;
    email: string;
    password: string;
    role: UserRole;
}

export interface AuthUser {
    id: number;
    name: string;
    email: string;
    role: UserRole;
    groupId?: number | null;
}

export interface AuthResponse {
    accessToken: string;
    user: AuthUser;
}
