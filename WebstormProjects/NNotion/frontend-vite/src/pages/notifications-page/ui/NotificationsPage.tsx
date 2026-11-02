import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/router/route-paths';
import { notificationsApi, type AppNotification } from '@/shared/api/notifications.api';
import { tokenStorage } from '@/shared/lib/token-storage';
import { Button } from '@/shared/ui/button/Button';
import { Card } from '@/shared/ui/card/Card';
import { SectionHeader } from '@/shared/ui/section-header/SectionHeader';
import { PageLayout } from '@/widgets/page-layout';

const fallbackNotifications: AppNotification[] = [
    {
        id: 1,
        type: 'POLL_CREATED',
        category: 'poll',
        status: 'SENT',
        createdAt: new Date().toISOString(),
        payload: {
            title: 'Опрос создан',
            message: 'Создан опрос по дисциплине. Группа: ИВТ-22-1. Варианты времени рассчитаны автоматически.',
            deadlineAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
    },
    {
        id: 2,
        type: 'POLL_VOTED',
        category: 'poll',
        status: 'SENT',
        createdAt: new Date().toISOString(),
        payload: {
            title: 'В опросе проголосовали',
            message: 'Появились голоса студентов: лидирует вариант 14:00 - 15:30.',
            options: ['10:00 - 11:30', '14:00 - 15:30', '16:00 - 17:30'],
        },
    },
    {
        id: 3,
        type: 'POLL_DEADLINE',
        category: 'poll',
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        scheduledFor: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        payload: {
            title: 'Дедлайн опроса',
            message: 'До окончания голосования остался 1 час.',
        },
    },
    {
        id: 4,
        type: 'TASK_REMINDER',
        category: 'task',
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        payload: {
            title: 'Напоминание о личной задаче',
            message: 'Проверьте материалы к занятию и личные задачи на сегодня.',
        },
    },
    {
        id: 5,
        type: 'SCHEDULE_REMINDER',
        category: 'event',
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        payload: {
            title: 'Напоминание о расписании',
            message: 'Скоро начнется занятие по расписанию.',
            startAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        },
    },
];

const getCategoryRoute = (category: string, role?: string) => {
    const categoryRoute: Record<string, string> = {
        poll: ROUTES.POLLS,
        event: ROUTES.EVENTS,
        task: role === 'student' ? ROUTES.STUDENT : ROUTES.TEACHER,
        system: ROUTES.PROFILE,
    };

    return categoryRoute[category] ?? ROUTES.PROFILE;
};

const formatDate = (value?: string | null) => {
    if (!value) {
        return 'Без даты';
    }

    return new Intl.DateTimeFormat('ru-RU', {
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(value));
};

export const NotificationsPage = () => {
    const [notifications, setNotifications] = useState<AppNotification[]>(fallbackNotifications);
    const currentUser = tokenStorage.getUser();

    useEffect(() => {
        let cancelled = false;

        notificationsApi.mine()
            .then((items) => {
                if (!cancelled && items.length > 0) {
                    setNotifications(items);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setNotifications(fallbackNotifications);
                }
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const unreadCount = useMemo(() => notifications.filter((item) => !item.readAt).length, [notifications]);

    const markRead = async (notification: AppNotification) => {
        if (notification.readAt) {
            return;
        }

        const readAt = new Date().toISOString();

        setNotifications((items) => items.map((item) => (
            item.id === notification.id ? { ...item, readAt } : item
        )));

        try {
            await notificationsApi.markRead(notification.id);
        } catch {
            // Local fallback still keeps the interface responsive for demo mode.
        }
    };

    const markAllRead = async () => {
        const unreadNotifications = notifications.filter((notification) => !notification.readAt);

        if (unreadNotifications.length === 0) {
            return;
        }

        const readAt = new Date().toISOString();
        setNotifications((items) => items.map((item) => (
            item.readAt ? item : { ...item, readAt }
        )));

        await Promise.all(unreadNotifications.map(async (notification) => {
            try {
                await notificationsApi.markRead(notification.id);
            } catch {
                // Local fallback still keeps the interface responsive for demo mode.
            }
        }));
    };

    return (
        <PageLayout>
            <section className="page-section">
                <SectionHeader
                    eyebrow="Notifications"
                    title="Уведомления"
                    description="История системных событий: опросы, голоса, дедлайны, личные задачи и расписание."
                />

                <div className="stats-grid">
                    <Card className="stat-card">
                        <span className="stat-card__eyebrow">All</span>
                        <strong className="stat-card__value">{notifications.length}</strong>
                        <p className="stat-card__label">Всего уведомлений</p>
                    </Card>
                    <Card className="stat-card">
                        <span className="stat-card__eyebrow">Unread</span>
                        <strong className="stat-card__value">{unreadCount}</strong>
                        <p className="stat-card__label">Новые</p>
                    </Card>
                </div>

                <div className="profile-actions">
                    <Button size="sm" variant="secondary" disabled={unreadCount === 0} onClick={markAllRead}>
                        Прочитать все
                    </Button>
                </div>

                <div className="record-list">
                    {notifications.map((notification) => (
                        <Card
                            className={`record-item record-item--${notification.category}`}
                            key={notification.id}
                            onClick={() => {
                                void markRead(notification);
                            }}
                        >
                            <div className="student-group__header">
                                <span className={`status-chip ${notification.readAt ? 'status-chip--closed' : 'status-chip--warning'}`}>
                                    {notification.readAt ? 'Прочитано' : 'Новое'}
                                </span>
                                <span className="record-item__meta">{formatDate(notification.createdAt)}</span>
                            </div>
                            <h2 className="record-item__title">{notification.payload?.title ?? notification.type}</h2>
                            <p>{notification.payload?.message ?? 'Детали уведомления доступны в связанной вкладке.'}</p>
                            {notification.payload?.deadlineAt ? (
                                <p className="record-item__meta">Дедлайн: <span className="deadline-text">{formatDate(notification.payload.deadlineAt)}</span></p>
                            ) : null}
                            {notification.payload?.startAt ? (
                                <p className="record-item__meta">Начало: {formatDate(notification.payload.startAt)}</p>
                            ) : null}
                            {notification.payload?.options?.length ? (
                                <div className="pill-group">
                                    {notification.payload.options.map((option) => <span className="tag-chip" key={option}>{option}</span>)}
                                </div>
                            ) : null}
                            <div className="profile-actions">
                                <Link
                                    className="button button--secondary button--sm"
                                    to={getCategoryRoute(notification.category, currentUser?.role)}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        void markRead(notification);
                                    }}
                                >
                                    Открыть
                                </Link>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        void markRead(notification);
                                    }}
                                >
                                    Отметить прочитанным
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>
            </section>
        </PageLayout>
    );
};
