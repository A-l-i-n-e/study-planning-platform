import { api } from './base';
import type { PlatformEvent } from '../types/event';

type BackendFormat = 'ONLINE' | 'OFFLINE';
type BackendEventStatus = 'scheduled' | 'cancelled' | 'completed';

interface BackendEvent {
    id: number;
    title: string;
    description?: string | null;
    teacherId: number;
    groupId?: number | null;
    startAt: string;
    endAt: string;
    format: BackendFormat;
    location?: string | null;
    link?: string | null;
    status: BackendEventStatus;
    teacher?: {
        id: number;
        name: string;
        email: string;
    };
    group?: {
        id: number;
        name: string;
    } | null;
}

export interface CreateEventPayload {
    title: string;
    description?: string | null;
    discipline?: string | null;
    lessonType: string;
    teacherId?: number | null;
    groupId?: number | null;
    startAt: string;
    endAt: string;
    format: BackendFormat;
    location?: string | null;
    link?: string | null;
}

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
});

const timeFormatter = new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
});

const toAttendanceStatus = (status: BackendEventStatus): PlatformEvent['status'] => {
    if (status === 'completed') {
        return 'registered';
    }

    if (status === 'cancelled') {
        return 'waitlist';
    }

    return 'open';
};

export const mapBackendEvent = (event: BackendEvent): PlatformEvent => {
    const start = new Date(event.startAt);
    const end = new Date(event.endAt);

    return {
        id: String(event.id),
        rawId: event.id,
        title: event.title,
        teacher: event.teacher?.name ?? `Преподаватель #${event.teacherId}`,
        group: event.group?.name,
        dateKey: event.startAt.slice(0, 10),
        date: dateFormatter.format(start),
        time: `${timeFormatter.format(start)} - ${timeFormatter.format(end)}`,
        format: event.format === 'ONLINE' ? 'online' : 'offline',
        place: event.link || event.location || (event.format === 'ONLINE' ? 'Онлайн' : ''),
        status: toAttendanceStatus(event.status),
        description: event.description ?? 'Описание не указано',
    };
};

export const eventsApi = {
    list: async (): Promise<PlatformEvent[]> => {
        const response = await api.get<{ events: BackendEvent[] }>('/events');

        return response.data.events.map(mapBackendEvent);
    },

    create: async (payload: CreateEventPayload): Promise<PlatformEvent> => {
        const response = await api.post<{ event: BackendEvent }>('/events', payload);

        return mapBackendEvent(response.data.event);
    },
};
