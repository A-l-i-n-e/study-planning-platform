export type UserRole = 'student' | 'teacher' | 'admin';

export interface PlatformUser {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    group?: string;
    groupId?: number | null;
    isActive?: boolean;
    status: 'active' | 'review' | 'offline';
}

export interface UserProfile {
    name: string;
    email: string;
    role: UserRole;
    group?: string;
    department?: string;
    phone?: string;
    status: string;
    activity: {
        lessons: number;
        polls: number;
        nearestLesson: string;
    };
}
