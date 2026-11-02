import { NavLink } from 'react-router-dom';
import { ROUTES } from '@/app/router/route-paths';
import { cn } from '@/shared/lib/cn';
import { tokenStorage } from '@/shared/lib/token-storage';
import type { AuthUser } from '@/shared/types/auth';
import './Navbar.scss';

const navLabels = {
    calendar: 'Календарь',
    polls: 'Опросы',
    events: 'Занятия',
    notifications: 'Уведомления',
    profile: 'Профиль',
    home: 'Главная',
    subtitle: 'Учебное планирование',
};

const navItemsByRole: Record<AuthUser['role'], Array<{ label: string; to: string }>> = {
    student: [
        { label: navLabels.calendar, to: ROUTES.STUDENT },
        { label: navLabels.polls, to: ROUTES.POLLS },
        { label: navLabels.events, to: ROUTES.EVENTS },
        { label: navLabels.notifications, to: ROUTES.NOTIFICATIONS },
        { label: navLabels.profile, to: ROUTES.PROFILE },
    ],
    teacher: [
        { label: navLabels.calendar, to: ROUTES.TEACHER },
        { label: navLabels.polls, to: ROUTES.POLLS },
        { label: navLabels.events, to: ROUTES.EVENTS },
        { label: navLabels.notifications, to: ROUTES.NOTIFICATIONS },
        { label: navLabels.profile, to: ROUTES.PROFILE },
    ],
    admin: [
        { label: navLabels.home, to: ROUTES.ADMIN },
        { label: navLabels.polls, to: ROUTES.POLLS },
        { label: navLabels.profile, to: ROUTES.PROFILE },
    ],
};

export const Navbar = () => {
    const user = tokenStorage.getUser();
    const navItems = user ? navItemsByRole[user.role] : [];

    return (
        <header className="navbar">
            <NavLink className="navbar__brand" to={user ? navItems[0]?.to ?? ROUTES.PROFILE : ROUTES.LOGIN}>
                <span className="navbar__brand-mark">NN</span>
                <span className="navbar__brand-copy">
                    <strong>NNotion</strong>
                    <span>{navLabels.subtitle}</span>
                </span>
            </NavLink>

            <nav className="navbar__nav" aria-label="Основная навигация">
                {navItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                            cn('navbar__link', isActive && 'navbar__link--active')
                        }
                    >
                        {item.label}
                    </NavLink>
                ))}
            </nav>
        </header>
    );
};
