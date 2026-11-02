export type EventFormat = 'online' | 'offline';
export type EventAttendanceStatus = 'registered' | 'open' | 'waitlist';

export interface PlatformEvent {
    id: string;
    rawId?: number;
    title: string;
    teacher: string;
    group?: string;
    dateKey?: string;
    date: string;
    time: string;
    format: EventFormat;
    place: string;
    status: EventAttendanceStatus;
    description: string;
}
