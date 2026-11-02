import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/router/route-paths';
import { eventsApi } from '@/shared/api/events.api';
import { groupsApi } from '@/shared/api/groups.api';
import type { StudyGroup } from '@/shared/api/polls.api';
import { mockEvents } from '@/shared/lib/mock-data';
import { tokenStorage } from '@/shared/lib/token-storage';
import type { PlatformEvent } from '@/shared/types/event';
import { Button } from '@/shared/ui/button/Button';
import { Card } from '@/shared/ui/card/Card';
import { Input } from '@/shared/ui/input/Input';
import { SectionHeader } from '@/shared/ui/section-header/SectionHeader';
import { Select } from '@/shared/ui/select/Select';
import { Textarea } from '@/shared/ui/textarea/Textarea';
import { PageLayout } from '@/widgets/page-layout';

type EventsFilter = 'all' | 'today' | 'week' | 'online' | 'offline';
type LessonType = 'лекция' | 'семинар' | 'консультация' | 'мастер-класс' | 'кружок' | 'другое';

const filterLabels: Record<EventsFilter, string> = {
    all: 'Все',
    today: 'Сегодня',
    week: 'На неделе',
    online: 'Онлайн',
    offline: 'Очно',
};

const attendanceLabels: Record<PlatformEvent['status'], string> = {
    registered: 'Подтверждено',
    open: 'Открыта запись',
    waitlist: 'Лист ожидания',
};

const lessonTypes: LessonType[] = ['лекция', 'семинар', 'консультация', 'мастер-класс', 'кружок', 'другое'];
const toDateValue = (date: Date) => {
    const timezoneOffset = date.getTimezoneOffset() * 60 * 1000;

    return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 10);
};
const todayValue = toDateValue(new Date());
const weekEndDate = new Date();
weekEndDate.setDate(weekEndDate.getDate() + 6);
const weekEndValue = toDateValue(weekEndDate);

const filterEvents = (events: PlatformEvent[], filter: EventsFilter) => {
    if (filter === 'today') {
        return events.filter((event) => event.dateKey === todayValue);
    }

    if (filter === 'week') {
        return events.filter((event) => event.dateKey && event.dateKey >= todayValue && event.dateKey <= weekEndValue);
    }

    if (filter === 'online') {
        return events.filter((event) => event.format === 'online');
    }

    if (filter === 'offline') {
        return events.filter((event) => event.format === 'offline');
    }

    return events;
};

export const EventsPage = () => {
    const [activeFilter, setActiveFilter] = useState<EventsFilter>('all');
    const [eventsFromApi, setEventsFromApi] = useState<PlatformEvent[]>([]);
    const [groups, setGroups] = useState<StudyGroup[]>([]);
    const [apiReady, setApiReady] = useState(false);
    const [serverMessage, setServerMessage] = useState('');
    const [eventTitle, setEventTitle] = useState('');
    const [eventDescription, setEventDescription] = useState('');
    const [eventDate, setEventDate] = useState('');
    const [eventTime, setEventTime] = useState('');
    const [eventGroup, setEventGroup] = useState('');
    const [eventDiscipline, setEventDiscipline] = useState('');
    const [eventLessonType, setEventLessonType] = useState<LessonType>('консультация');
    const [eventFormat, setEventFormat] = useState<PlatformEvent['format']>('offline');
    const [eventPlace, setEventPlace] = useState('');
    const [reminderEnabled, setReminderEnabled] = useState(false);
    const [reminderBefore, setReminderBefore] = useState('30');
    const [reminderRepeat, setReminderRepeat] = useState('none');
    const currentUser = tokenStorage.getUser();
    const canCreateEvents = currentUser?.role === 'teacher';
    const events = useMemo(() => (apiReady && eventsFromApi.length ? eventsFromApi : mockEvents), [apiReady, eventsFromApi]);
    const featuredEvent = events[0];
    const visibleEvents = useMemo(() => filterEvents(events, activeFilter), [activeFilter, events]);

    useEffect(() => {
        let cancelled = false;

        Promise.all([eventsApi.list(), groupsApi.list()])
            .then(([loadedEvents, loadedGroups]) => {
                if (cancelled) {
                    return;
                }

                setEventsFromApi(loadedEvents);
                setGroups(loadedGroups);
                setApiReady(true);
            })
            .catch(() => {
                if (!cancelled) {
                    setApiReady(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const findGroupId = () => {
        const trimmedGroup = eventGroup.trim();
        const numericGroupId = Number(trimmedGroup);

        if (Number.isInteger(numericGroupId) && numericGroupId > 0) {
            return numericGroupId;
        }

        return groups.find((group) => group.name.toLowerCase() === trimmedGroup.toLowerCase())?.id ?? null;
    };

    const createEvent = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const trimmedTitle = eventTitle.trim();

        if (!trimmedTitle || !eventDate || !eventTime || eventDate < todayValue || !eventGroup.trim()) {
            return;
        }

        const groupId = findGroupId();

        if (!apiReady || !groupId) {
            setServerMessage('Выберите существующую группу из базы или укажите её номер.');
            return;
        }

        try {
            const startAt = new Date(`${eventDate}T${eventTime}`);
            const endAt = new Date(startAt);
            const link = eventFormat === 'online' ? eventPlace.trim() : '';
            endAt.setMinutes(endAt.getMinutes() + 90);

            setServerMessage('');
            const createdEvent = await eventsApi.create({
                title: trimmedTitle,
                description: eventDescription.trim() || null,
                discipline: eventDiscipline.trim() || null,
                lessonType: eventLessonType,
                groupId,
                startAt: startAt.toISOString(),
                endAt: endAt.toISOString(),
                format: eventFormat === 'online' ? 'ONLINE' : 'OFFLINE',
                location: null,
                link: link || null,
            });

            setEventsFromApi((items) => [createdEvent, ...items]);
            setEventTitle('');
            setEventDescription('');
            setEventDate('');
            setEventTime('');
            setEventGroup('');
            setEventDiscipline('');
            setEventLessonType('консультация');
            setEventFormat('offline');
            setEventPlace('');
            setReminderEnabled(false);
            setReminderBefore('30');
            setReminderRepeat('none');
            setActiveFilter('all');
        } catch {
            setServerMessage('Не удалось создать занятие. Проверьте группу, время и расписание.');
        }
    };

    return (
        <PageLayout>
            <section className="page-section">
                <SectionHeader
                    eyebrow="Занятия"
                    title="Дополнительные занятия"
                    description="Все консультации, практики и встречи в одном расписании."
                />

                <div className="pill-group">
                    {(Object.keys(filterLabels) as EventsFilter[]).map((filterKey) => (
                        <button
                            key={filterKey}
                            type="button"
                            className={`button ${activeFilter === filterKey ? 'button--primary' : 'button--ghost'} button--sm`}
                            onClick={() => setActiveFilter(filterKey)}
                        >
                            {filterLabels[filterKey]}
                        </button>
                    ))}
                </div>

                {canCreateEvents ? (
                    <div className="cards-grid cards-grid--two">
                        <Card className="quick-link" hoverable>
                            <span className="eyebrow">Опрос</span>
                            <h2 className="quick-link__title">Создать опрос</h2>
                            <p>Опрос можно создать прямо из вкладки занятий: откроется форма выбора группы и студентов.</p>
                            <Link className="button button--secondary button--sm" to={ROUTES.POLLS}>
                                Перейти к созданию опроса
                            </Link>
                        </Card>

                        <Card className="stack">
                            <div className="mini-stack">
                                <span className="eyebrow">Новое занятие</span>
                                <h2 className="detail-panel__title">Создать занятие</h2>
                                <p className="subtle-text">
                                    Новое занятие сразу появится в списке и будет доступно в общем календаре.
                                </p>
                            </div>

                            <form className="form-grid" onSubmit={createEvent}>
                            <Input
                                label="Название"
                                value={eventTitle}
                                onChange={(event) => setEventTitle(event.target.value)}
                                placeholder="Например, консультация по курсовой"
                            />
                            <Input
                                label="Дата"
                                type="date"
                                value={eventDate}
                                onChange={(event) => setEventDate(event.target.value)}
                                min={todayValue}
                            />
                            <Input
                                label="Время"
                                type="time"
                                value={eventTime}
                                onChange={(event) => setEventTime(event.target.value)}
                            />
                            <Input
                                label="Группа"
                                value={eventGroup}
                                onChange={(event) => setEventGroup(event.target.value)}
                                placeholder={groups[0]?.name ?? 'ИВТ-301 или номер группы'}
                            />
                            <Input
                                label="Дисциплина"
                                value={eventDiscipline}
                                onChange={(event) => setEventDiscipline(event.target.value)}
                                placeholder="Алгоритмы"
                            />
                            <Select
                                label="Тип занятия"
                                value={eventLessonType}
                                onChange={(event) => setEventLessonType(event.target.value as LessonType)}
                            >
                                {lessonTypes.map((item) => (
                                    <option value={item} key={item}>{item}</option>
                                ))}
                            </Select>
                            <Select
                                label="Формат"
                                value={eventFormat}
                                onChange={(event) => setEventFormat(event.target.value as PlatformEvent['format'])}
                            >
                                <option value="offline">Очно</option>
                                <option value="online">Онлайн</option>
                            </Select>
                            {eventFormat === 'online' ? (
                                <Input
                                    label="Ссылка"
                                    value={eventPlace}
                                    onChange={(event) => setEventPlace(event.target.value)}
                                    placeholder="https://meet..."
                                />
                            ) : null}
                            <div className="form-grid__full">
                                <Textarea
                                    label="Описание"
                                    value={eventDescription}
                                    onChange={(event) => setEventDescription(event.target.value)}
                                    placeholder="Коротко о теме занятия"
                                />
                            </div>
                                <div className="form-grid__full reminder-box">
                                    <label className="check-item">
                                        <input
                                            type="checkbox"
                                            checked={reminderEnabled}
                                            onChange={(event) => setReminderEnabled(event.target.checked)}
                                        />
                                        <span>Добавить напоминание</span>
                                    </label>
                                    {reminderEnabled ? (
                                        <div className="form-grid">
                                            <Select label="За сколько" value={reminderBefore} onChange={(event) => setReminderBefore(event.target.value)}>
                                                <option value="10">За 10 минут</option>
                                                <option value="30">За 30 минут</option>
                                                <option value="60">За 1 час</option>
                                                <option value="1440">За 1 день</option>
                                            </Select>
                                            <Select label="Повтор" value={reminderRepeat} onChange={(event) => setReminderRepeat(event.target.value)}>
                                                <option value="none">Не повторять</option>
                                                <option value="daily">Каждый день</option>
                                                <option value="weekly">Каждую неделю</option>
                                            </Select>
                                        </div>
                                    ) : null}
                                </div>
                                <div className="form-grid__full">
                                    {serverMessage ? <div className="alert">{serverMessage}</div> : null}
                                    <Button type="submit">Создать занятие</Button>
                                </div>
                            </form>
                        </Card>
                    </div>
                ) : null}

                <div className="split-grid">
                    <Card className="event-card">
                        <span className="eyebrow">Ближайшее</span>
                        <h2 className="event-card__title">Ближайшее занятие</h2>
                        <p>{featuredEvent.title}</p>
                        <div className="meta-grid">
                            <div className="meta-item">
                                <span className="meta-item__label">Преподаватель</span>
                                <span className="meta-item__value">{featuredEvent.teacher}</span>
                            </div>
                            <div className="meta-item">
                                <span className="meta-item__label">Дата</span>
                                <span className="meta-item__value">{featuredEvent.date}</span>
                            </div>
                            <div className="meta-item">
                                <span className="meta-item__label">Время</span>
                                <span className="meta-item__value">{featuredEvent.time}</span>
                            </div>
                            <div className="meta-item">
                                <span className="meta-item__label">Группа</span>
                                <span className="meta-item__value">{featuredEvent.group ?? 'Без группы'}</span>
                            </div>
                        </div>
                    </Card>

                    <div className="cards-grid cards-grid--two">
                        {visibleEvents.map((event) => (
                            <Card className="event-card" hoverable key={event.id}>
                                <div className="mini-stack">
                                    <span className={`status-chip ${event.format === 'online' ? 'status-chip--warning' : 'status-chip--active'}`}>
                                        {event.format === 'online' ? 'Онлайн' : 'Очно'}
                                    </span>
                                    <h2 className="event-card__title">{event.title}</h2>
                                    <p>{event.description}</p>
                                </div>

                                <div className="meta-grid">
                                    <div className="meta-item">
                                        <span className="meta-item__label">Преподаватель</span>
                                        <span className="meta-item__value">{event.teacher}</span>
                                    </div>
                                    <div className="meta-item">
                                        <span className="meta-item__label">Дата</span>
                                        <span className="meta-item__value">{event.date}</span>
                                    </div>
                                    <div className="meta-item">
                                        <span className="meta-item__label">Время</span>
                                        <span className="meta-item__value">{event.time}</span>
                                    </div>
                                    <div className="meta-item">
                                        <span className="meta-item__label">Группа</span>
                                        <span className="meta-item__value">{event.group ?? 'Без группы'}</span>
                                    </div>
                                </div>

                                <span className="status-chip status-chip--closed">{attendanceLabels[event.status]}</span>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>
        </PageLayout>
    );
};
