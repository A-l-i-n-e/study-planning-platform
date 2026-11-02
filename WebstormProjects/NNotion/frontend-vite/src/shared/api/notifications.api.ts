import { api } from './base';

export interface AppNotification {
    id: number;
    type: string;
    category: 'system' | 'poll' | 'event' | 'task' | string;
    payload?: {
        title?: string;
        message?: string;
        deadlineAt?: string;
        startAt?: string;
        endAt?: string;
        group?: string;
        options?: string[];
        [key: string]: unknown;
    } | null;
    status: 'PENDING' | 'SENT' | 'FAILED';
    createdAt: string;
    readAt?: string | null;
    scheduledFor?: string | null;
}

export const notificationsApi = {
    mine: async (): Promise<AppNotification[]> => {
        const response = await api.get<{ notifications: AppNotification[] }>('/notifications/me');

        return response.data.notifications;
    },

    markRead: async (id: number): Promise<void> => {
        await api.patch(`/notifications/${id}/read`, { read: true });
    },
};
