import type { UserRole } from '@/shared/types/user';
import { cn } from '@/shared/lib/cn';

const roleLabels: Record<UserRole, string> = {
    student: 'Студент',
    teacher: 'Преподаватель',
    admin: 'Админ',
};

interface RoleBadgeProps {
    role: UserRole;
}

export const RoleBadge = ({ role }: RoleBadgeProps) => {
    return <span className={cn('role-badge', `role-badge--${role}`)}>{roleLabels[role]}</span>;
};
