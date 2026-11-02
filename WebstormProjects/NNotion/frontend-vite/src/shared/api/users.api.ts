import { api } from './base';
import type { UserRole } from '../types/user';

export interface AdminStats {
    studentsCount: number;
    teachersCount: number;
    groupsCount: number;
    pollsCount: number;
    eventsCount: number;
}

export interface BackendUser {
    id: number;
    name: string;
    email: string;
    role: UserRole;
    groupId?: number | null;
    isActive?: boolean;
    createdAt?: string;
    group?: {
        id: number;
        name: string;
        description?: string | null;
        teacherId?: number | null;
    } | null;
}

export interface CreateAdminUserPayload {
    name: string;
    email: string;
    passHash: string;
    role: UserRole;
    groupId?: number | null;
}

export interface UpdateUserPayload {
    name?: string;
    email?: string;
    role?: UserRole;
    groupId?: number | null;
    isActive?: boolean;
}

export interface UserListParams {
    role?: UserRole;
    search?: string;
    groupId?: number;
    isActive?: boolean;
}

export const usersApi = {
    getAdminStats: async (): Promise<AdminStats> => {
        const response = await api.get<{ stats: AdminStats }>('/admin/stats');

        return response.data.stats;
    },
    changePassword: async (payload: {
        oldPassword: string;
        newPassword: string;
        confirmPassword: string;
    }): Promise<{ success: boolean }> => {
        const response = await api.post<{ success: boolean }>('/users/change-password', payload);

        return response.data;
    },
    list: async (params?: UserListParams): Promise<BackendUser[]> => {
        const response = await api.get<{ users: BackendUser[] }>('/users', { params });

        return response.data.users;
    },
    createByAdmin: async (payload: CreateAdminUserPayload): Promise<BackendUser> => {
        const response = await api.post<{ user: BackendUser }>('/users', payload);

        return response.data.user;
    },
    update: async (id: string | number, payload: UpdateUserPayload): Promise<BackendUser> => {
        const response = await api.patch<{ user: BackendUser }>(`/users/${id}`, payload);

        return response.data.user;
    },
    remove: async (id: string | number): Promise<void> => {
        await api.delete(`/users/${id}`);
    },
};
