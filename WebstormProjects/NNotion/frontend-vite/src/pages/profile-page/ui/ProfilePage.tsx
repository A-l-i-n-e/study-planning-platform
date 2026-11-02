import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/app/router/route-paths';
import { usersApi } from '@/shared/api/users.api';
import { mockProfile } from '@/shared/lib/mock-data';
import { IS_DEMO } from '@/shared/demo/config';
import { tokenStorage } from '@/shared/lib/token-storage';
import type { AuthUser } from '@/shared/types/auth';
import { Button } from '@/shared/ui/button/Button';
import { Card } from '@/shared/ui/card/Card';
import { Input } from '@/shared/ui/input/Input';
import { RoleBadge } from '@/shared/ui/role-badge/RoleBadge';
import { SectionHeader } from '@/shared/ui/section-header/SectionHeader';
import { StatCard } from '@/shared/ui/stat-card/StatCard';
import { PageLayout } from '@/widgets/page-layout';

type AppTheme = 'dark' | 'light' | 'gray';
type ProfileSettings = {
    email?: string;
    name?: string;
    phone?: string;
};
type NotificationFilter = 'new' | 'read' | 'system' | 'poll' | 'event' | 'task';
type NotificationHistoryItem = {
    id: string;
    type: 'poll' | 'event' | 'task' | 'system';
    status: 'new' | 'read';
    title: string;
    meta: string;
};

const themeLabels: Record<AppTheme, string> = {
    dark: 'Темная',
    light: 'Светлая',
    gray: 'Серая',
};

const roleHome: Record<AuthUser['role'], string> = {
    student: ROUTES.STUDENT,
    teacher: ROUTES.TEACHER,
    admin: ROUTES.ADMIN,
};

const notificationHistory: NotificationHistoryItem[] = [
    { id: 'n1', type: 'poll', status: 'new', title: 'Создан новый опрос', meta: 'Опросы · новое' },
    { id: 'n2', type: 'event', status: 'read', title: 'Итоговое занятие согласовано', meta: 'Занятия · прочитано' },
    { id: 'n3', type: 'task', status: 'read', title: 'Личная задача на сегодня', meta: 'Личные задачи · прочитано' },
    { id: 'n4', type: 'system', status: 'new', title: 'Настройки уведомлений обновлены', meta: 'Системные · новое' },
];

const notificationFilters: Array<{ id: NotificationFilter; label: string }> = [
    { id: 'new', label: 'Новые' },
    { id: 'read', label: 'Прочитанные' },
    { id: 'system', label: 'Системные' },
    { id: 'poll', label: 'Опросы' },
    { id: 'event', label: 'Занятия' },
    { id: 'task', label: 'Личные задачи' },
];

const getInitialTheme = (): AppTheme => {
    const storedTheme = localStorage.getItem('appTheme');

    if (storedTheme === 'light' || storedTheme === 'gray' || storedTheme === 'dark') {
        return storedTheme;
    }

    return 'dark';
};

const profileStorageKey = (userId: number) => `${IS_DEMO ? 'demo:' : ''}profileSettings:${userId}`;

const getProfileSettings = (userId?: number): ProfileSettings => {
    const rawSettings = userId ? localStorage.getItem(profileStorageKey(userId)) : null;

    if (!rawSettings) {
        return {};
    }

    try {
        return JSON.parse(rawSettings) as ProfileSettings;
    } catch {
        if (userId) {
            localStorage.removeItem(profileStorageKey(userId));
        }
        return {};
    }
};

export const ProfilePage = () => {
    const navigate = useNavigate();
    const authUser = tokenStorage.getUser();
    const savedSettings = useMemo(() => getProfileSettings(authUser?.id), [authUser?.id]);
    const [theme, setTheme] = useState<AppTheme>(getInitialTheme);
    const [name, setName] = useState(authUser?.name ?? savedSettings.name ?? mockProfile.name);
    const [email, setEmail] = useState(authUser?.email ?? savedSettings.email ?? mockProfile.email);
    const [phone, setPhone] = useState(savedSettings.phone ?? mockProfile.phone ?? '');
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordMessage, setPasswordMessage] = useState('');
    const [activeNotificationFilter, setActiveNotificationFilter] = useState<NotificationFilter>('new');
    const role = authUser?.role ?? mockProfile.role;

    const filteredNotificationHistory = useMemo(
        () => notificationHistory.filter((item) =>
            activeNotificationFilter === 'new' || activeNotificationFilter === 'read'
                ? item.status === activeNotificationFilter
                : item.type === activeNotificationFilter,
        ),
        [activeNotificationFilter],
    );

    const initials = useMemo(
        () =>
            name
                .split(' ')
                .filter(Boolean)
                .map((part) => part[0])
                .join('')
                .slice(0, 2)
                .toUpperCase() || 'NN',
        [name],
    );

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        localStorage.setItem('appTheme', theme);
    }, [theme]);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            setName(authUser?.name ?? savedSettings.name ?? mockProfile.name);
            setEmail(authUser?.email ?? savedSettings.email ?? mockProfile.email);
            setPhone(savedSettings.phone ?? mockProfile.phone ?? '');
        }, 0);

        return () => window.clearTimeout(timeoutId);
    }, [authUser?.email, authUser?.name, savedSettings.email, savedSettings.name, savedSettings.phone]);

    const saveProfile = () => {
        if (!authUser) {
            return;
        }

        localStorage.setItem(profileStorageKey(authUser.id), JSON.stringify({ email, name, phone }));

        tokenStorage.setUser({
            ...authUser,
            name,
            email,
        });
    };

    const logout = () => {
        tokenStorage.clearAuth();
        navigate(ROUTES.LOGIN, { replace: true });
    };

    const changePassword = async () => {
        setPasswordMessage('');

        if (newPassword !== confirmPassword) {
            setPasswordMessage('Новый пароль и подтверждение не совпадают.');
            return;
        }

        try {
            await usersApi.changePassword({ oldPassword, newPassword, confirmPassword });
            setPasswordMessage('Пароль изменён.');
            setOldPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch {
            setPasswordMessage('Не удалось изменить пароль. Проверьте старый пароль.');
        }
    };

    const goHome = () => {
        if (authUser) {
            navigate(roleHome[authUser.role]);
        }
    };

    const openNotification = (type: string) => {
        if (type === 'poll') {
            navigate(ROUTES.POLLS);
            return;
        }

        if (type === 'event') {
            navigate(ROUTES.EVENTS);
            return;
        }

        goHome();
    };

    return (
        <PageLayout>
            <section className="page-section">
                <SectionHeader
                    eyebrow="Профиль"
                    title="Личный кабинет"
                    description="Настройки аккаунта, язык, почта, тема приложения и выход из личного аккаунта."
                />

                <div className="profile-grid profile-grid--wide">
                    <Card className="user-profile-card">
                        <div className="stack">
                            <div className="avatar">{initials}</div>
                            <div className="mini-stack">
                                <h2 className="poll-card__title">{name}</h2>
                                <p>{email}</p>
                            </div>
                            <RoleBadge role={role} />
                            <span className="status-chip status-chip--active">Активный аккаунт</span>
                            <div className="profile-actions">
                                <Button variant="secondary" onClick={goHome}>К календарю</Button>
                                <Button variant="danger" onClick={logout}>{IS_DEMO ? 'Сменить роль' : 'Выйти'}</Button>
                            </div>
                        </div>
                    </Card>

                    <Card className="stack settings-panel">
                        <h2 className="list-card__title">Настройки профиля</h2>
                        <div className="form-grid">
                            <Input label="Имя" value={name} onChange={(event) => setName(event.target.value)} />
                            <Input label="Почта" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
                            <Input label="Телефон" value={phone} onChange={(event) => setPhone(event.target.value)} />
                        </div>
                        <Button onClick={saveProfile}>Сохранить профиль</Button>
                    </Card>
                </div>

                <div className="stats-grid">
                    <StatCard eyebrow="Активность" label="Количество занятий" value={String(mockProfile.activity.lessons)} hint="Все запланированные и подтвержденные слоты." />
                    <StatCard eyebrow="Опросы" label="Созданные опросы" value={String(mockProfile.activity.polls)} hint="Опросы, созданные преподавателем для выбора времени." />
                    <StatCard eyebrow="Главная" label="Главная страница" value="Календарь" hint="После входа студент и преподаватель попадают в календарь." />
                    <StatCard eyebrow="Тема" label="Текущая тема" value={themeLabels[theme]} hint="Тема применяется ко всему интерфейсу." />
                </div>

                <Card className="stack settings-panel">
                    <h2 className="list-card__title">Тема приложения</h2>
                    <div className="theme-switcher">
                        {(Object.keys(themeLabels) as AppTheme[]).map((themeKey) => (
                            <button
                                type="button"
                                className={`theme-option theme-option--${themeKey} ${theme === themeKey ? 'theme-option--active' : ''}`}
                                key={themeKey}
                                onClick={() => setTheme(themeKey)}
                            >
                                <span className="theme-option__swatch" />
                                <span>{themeLabels[themeKey]}</span>
                            </button>
                        ))}
                    </div>
                </Card>

                <div className="profile-grid">
                    <Card className="stack settings-panel">
                        <h2 className="list-card__title">Изменить пароль</h2>
                        {IS_DEMO ? <p>В демо вход выполняется выбором роли. Пароль не требуется.</p> : <>
                        <div className="form-grid">
                            <Input label="Старый пароль" type="password" value={oldPassword} onChange={(event) => setOldPassword(event.target.value)} />
                            <Input label="Новый пароль" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
                            <Input label="Подтверждение" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
                        </div>
                        {passwordMessage ? <p className="subtle-text">{passwordMessage}</p> : null}
                        <Button onClick={changePassword}>Сменить пароль</Button>
                        </>}
                    </Card>

                    <Card className="stack settings-panel">
                        <h2 className="list-card__title">История уведомлений</h2>
                        <div className="pill-group">
                            {notificationFilters.map((filter) => (
                                <button
                                    type="button"
                                    className={`tag-chip tag-chip--button ${activeNotificationFilter === filter.id ? 'tag-chip--active' : ''}`}
                                    key={filter.id}
                                    onClick={() => setActiveNotificationFilter(filter.id)}
                                >
                                    {filter.label}
                                </button>
                            ))}
                        </div>
                        <div className="record-list">
                            {filteredNotificationHistory.length ? filteredNotificationHistory.map((item) => (
                                <button
                                    className={`record-item record-item--${item.type} record-item--clickable`}
                                    key={item.id}
                                    onClick={() => openNotification(item.type)}
                                    type="button"
                                >
                                    <span className={`status-chip ${item.status === 'new' ? 'status-chip--warning' : 'status-chip--closed'}`}>
                                        {item.status === 'new' ? 'Новое' : 'Прочитано'}
                                    </span>
                                    <h3 className="record-item__title">{item.title}</h3>
                                    <p className="record-item__meta">{item.meta}</p>
                                </button>
                            )) : (
                                <p className="subtle-text">Уведомлений в этой категории пока нет.</p>
                            )}
                        </div>
                    </Card>
                </div>
            </section>
        </PageLayout>
    );
};
