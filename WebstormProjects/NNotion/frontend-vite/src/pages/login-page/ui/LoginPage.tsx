import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ROUTES } from '@/app/router/route-paths';
import { authApi } from '@/shared/api/auth.api';
import { tokenStorage } from '@/shared/lib/token-storage';
import type { AuthUser, LoginUserOption } from '@/shared/types/auth';
import type { UserRole } from '@/shared/types/user';
import { Button } from '@/shared/ui/button/Button';
import { Input } from '@/shared/ui/input/Input';
import { PageLayout } from '@/widgets/page-layout';
import './LoginPage.scss';

type RoleFilter = UserRole | 'all';

const roleHome: Record<AuthUser['role'], string> = {
    student: ROUTES.STUDENT,
    teacher: ROUTES.TEACHER,
    admin: ROUTES.ADMIN,
};

const roleLabels: Record<UserRole, string> = {
    student: 'Студент',
    teacher: 'Преподаватель',
    admin: 'Администратор',
};

const roleFilters: Array<{ label: string; value: RoleFilter }> = [
    { label: 'Все', value: 'all' },
    { label: 'Студенты', value: 'student' },
    { label: 'Преподаватели', value: 'teacher' },
    { label: 'Админы', value: 'admin' },
];

const getInitials = (name: string) => {
    const initials = name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase();

    return initials || 'П';
};

const getUserMeta = (user: LoginUserOption) => {
    return [roleLabels[user.role], user.group?.name].filter(Boolean).join(' · ');
};

export const LoginPage = () => {
    const navigate = useNavigate();
    const [serverError, setServerError] = useState('');
    const [users, setUsers] = useState<LoginUserOption[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
    const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoadingUsers, setIsLoadingUsers] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        let isActive = true;

        const loadUsers = async () => {
            try {
                setServerError('');
                setIsLoadingUsers(true);

                const loadedUsers = await authApi.loginOptions();

                if (!isActive) {
                    return;
                }

                setUsers(loadedUsers);
                setSelectedUserId(loadedUsers[0]?.id ?? null);

                if (loadedUsers.length === 0) {
                    setServerError('В базе данных пока нет пользователей для входа.');
                }
            } catch (error) {
                if (isActive) {
                    setServerError('Не удалось загрузить пользователей из базы. Проверьте, что сервер запущен.');
                }

                console.error(error);
            } finally {
                if (isActive) {
                    setIsLoadingUsers(false);
                }
            }
        };

        loadUsers();

        return () => {
            isActive = false;
        };
    }, []);

    const filteredUsers = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();

        return users.filter((user) => {
            const matchesRole = roleFilter === 'all' || user.role === roleFilter;
            const searchableText = [
                user.name,
                user.email,
                roleLabels[user.role],
                user.group?.name,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            return matchesRole && (!query || searchableText.includes(query));
        });
    }, [roleFilter, searchQuery, users]);

    useEffect(() => {
        if (filteredUsers.length === 0) {
            setSelectedUserId(null);
            return;
        }

        if (!selectedUserId || !filteredUsers.some((user) => user.id === selectedUserId)) {
            setSelectedUserId(filteredUsers[0].id);
        }
    }, [filteredUsers, selectedUserId]);

    const selectedUser = users.find((user) => user.id === selectedUserId) ?? null;

    const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (isSubmitting) {
            return;
        }

        if (!selectedUser) {
            setServerError('Выберите пользователя для входа.');
            return;
        }

        try {
            setServerError('');
            setIsSubmitting(true);

            const response = await authApi.userLogin({ userId: selectedUser.id });
            tokenStorage.setAccessToken(response.accessToken);
            tokenStorage.setUser(response.user);

            navigate(roleHome[response.user.role]);
        } catch (error) {
            setServerError('Не удалось войти в выбранный профиль. Проверьте сервер и попробуйте ещё раз.');
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <PageLayout withNavbar={false}>
            <section className="hero-grid auth-stage">
                <div className="auth-copy">
                    <div className="hero-kicker">
                        <span>Совместная работа</span>
                        <span>Учебное планирование</span>
                        <span>Тёмная тема</span>
                    </div>

                    <div className="auth-shell">
                        <h1 className="page-title">Выберите пользователя</h1>
                        <p className="section-description">
                            Найдите аккаунт из базы данных, и система откроет его рабочий кабинет.
                        </p>
                    </div>

                    <div className="editorial-word-stack">
                        {['Пользователи', 'Преподаватель', 'Администратор'].map((word, index) => (
                            <div className="editorial-word" key={word}>
                                <div className="editorial-word__label">{word}</div>
                                <p className="editorial-word__meta">
                                    {index === 0 && 'Любой профиль из базы'}
                                    {index === 1 && 'Проверка кабинета преподавателя'}
                                    {index === 2 && 'Быстрый доступ к управлению'}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="ui-card auth-card auth-stage__panel">
                    <span className="eyebrow">Точка входа</span>
                    <h2 className="auth-card__title">Автовход</h2>
                    <p className="auth-card__subtitle">
                        Выберите конкретного пользователя. Пароль вводить не нужно.
                    </p>

                    <form className="auth-form user-login-form" onSubmit={onSubmit}>
                        <Input
                            className="account-search"
                            label="Поиск"
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder="Имя, электронная почта или группа"
                            type="search"
                            value={searchQuery}
                        />

                        <div className="role-filter" aria-label="Фильтр по роли">
                            {roleFilters.map((filter) => (
                                <button
                                    className={`role-filter__button ${roleFilter === filter.value ? 'role-filter__button--active' : ''}`}
                                    disabled={isLoadingUsers || isSubmitting}
                                    key={filter.value}
                                    onClick={() => setRoleFilter(filter.value)}
                                    type="button"
                                >
                                    {filter.label}
                                </button>
                            ))}
                        </div>

                        <div className="user-picker" role="radiogroup" aria-label="Выбор пользователя">
                            {isLoadingUsers ? (
                                <p className="subtle-text">Загружаю пользователей...</p>
                            ) : null}

                            {!isLoadingUsers && filteredUsers.length === 0 ? (
                                <p className="subtle-text">Подходящих пользователей не найдено.</p>
                            ) : null}

                            {!isLoadingUsers && filteredUsers.map((user) => {
                                const isSelected = user.id === selectedUserId;

                                return (
                                    <button
                                        aria-pressed={isSelected}
                                        className={`user-option ${isSelected ? 'user-option--active' : ''}`}
                                        disabled={isSubmitting}
                                        key={user.id}
                                        onClick={() => setSelectedUserId(user.id)}
                                        type="button"
                                    >
                                        <span className={`user-option__avatar user-option__avatar--${user.role}`}>
                                            {getInitials(user.name)}
                                        </span>
                                        <span className="user-option__body">
                                            <span className="user-option__title">{user.name}</span>
                                            <span className="user-option__email">{user.email}</span>
                                            <span className="user-option__meta">{getUserMeta(user)}</span>
                                        </span>
                                        <span className="user-option__state">
                                            {isSelected ? 'Выбран' : 'Выбрать'}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {selectedUser ? (
                            <p className="selected-user">
                                Выбран: <strong>{selectedUser.name}</strong>
                            </p>
                        ) : null}

                        {serverError ? <div className="alert">{serverError}</div> : null}

                        <Button type="submit" fullWidth size="lg" disabled={isSubmitting || isLoadingUsers || !selectedUser}>
                            {isSubmitting ? 'Входим...' : 'Войти в выбранный профиль'}
                        </Button>
                    </form>

                    <p className="auth-footer">
                        Нет аккаунта? <Link to={ROUTES.REGISTER}>Создать профиль</Link>
                    </p>
                </div>
            </section>
        </PageLayout>
    );
};
