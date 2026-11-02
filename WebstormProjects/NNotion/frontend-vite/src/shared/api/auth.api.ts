import { api } from './base';
import type {
    AuthResponse,
    LoginRequest,
    LoginUserOption,
    RegisterRequest,
    RoleLoginRequest,
    UserLoginRequest,
} from '../types/auth';

type BackendAuthResponse = {
    user: AuthResponse['user'];
    token: string;
};

export const authApi = {
    login: async (data: LoginRequest): Promise<AuthResponse> => {
        const response = await api.post<BackendAuthResponse>('/auth/login', {
            email: data.email,
            password: data.password,
        });

        return {
            user: response.data.user,
            accessToken: response.data.token,
        };
    },

    roleLogin: async (data: RoleLoginRequest): Promise<AuthResponse> => {
        const response = await api.post<BackendAuthResponse>('/auth/role-login', {
            role: data.role,
        });

        return {
            user: response.data.user,
            accessToken: response.data.token,
        };
    },

    loginOptions: async (): Promise<LoginUserOption[]> => {
        const response = await api.get<{ users: LoginUserOption[] }>('/auth/login-options');

        return response.data.users;
    },

    userLogin: async (data: UserLoginRequest): Promise<AuthResponse> => {
        const response = await api.post<BackendAuthResponse>('/auth/user-login', {
            userId: data.userId,
        });

        return {
            user: response.data.user,
            accessToken: response.data.token,
        };
    },

    register: async (data: RegisterRequest): Promise<AuthResponse> => {
        const response = await api.post<BackendAuthResponse>('/auth/register', {
            name: data.name,
            email: data.email,
            passHash: data.password,
            role: data.role,
        });

        return {
            user: response.data.user,
            accessToken: response.data.token,
        };
    },
};
