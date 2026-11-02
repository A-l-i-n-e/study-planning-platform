import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/router/route-paths';
import { eventsApi } from '@/shared/api/events.api';
import { pollsApi } from '@/shared/api/polls.api';
import { mockPolls } from '@/shared/lib/mock-data';
import { IS_DEMO } from '@/shared/demo/config';
import { createDemoTasks } from '@/shared/demo/data';
import type { PlatformEvent } from '@/shared/types/event';
import type { PollPreview } from '@/shared/types/poll';
import { tokenStorage } from '@/shared/lib/token-storage';
import type { AuthUser } from '@/shared/types/auth';
import { Button } from '@/shared/ui/button/Button';
import { Card } from '@/shared/ui/card/Card';
import { Input } from '@/shared/ui/input/Input';
import { SectionHeader } from '@/shared/ui/section-header/SectionHeader';
import { Select } from '@/shared/ui/select/Select';
import { StatCard } from '@/shared/ui/stat-card/StatCard';

type DashboardRole = Extract<AuthUser['role'], 'student' | 'teacher'>;

type TodoItem = {
    id: string;
    title: string;
    time: string;
    source: 'schedule' | 'exam' | 'custom' | 'poll';
    completed: boolean;
};

type CalendarDay = {
    date: Date;
    key: string;
    day: number;
    muted: boolean;
    today: boolean;
};

const initialMonthDate = new Date();
initialMonthDate.setDate(1);
const weekdayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const viewLabels = {
    day: 'День',
    week: 'Неделя',
    month: 'Месяц',
} as const;

type CalendarView = keyof typeof viewLabels;
type CalendarColorTarget = 'custom' | 'exam' | 'schedule';
type CalendarColors = Record<CalendarColorTarget, string>;

const calendarColorTargets: CalendarColorTarget[] = ['custom', 'exam', 'schedule'];
const calendarColorLabels: Record<CalendarColorTarget, string> = {
    custom: 'Личные дела',
    exam: 'Экзамены',
    schedule: 'Расписание',
};
const defaultCalendarColors: CalendarColors = {
    custom: '#a6e6c1',
    exam: '#ff8ba7',
    schedule: '#5fb3ff',
};

type ScheduleSeed = {
    date: string;
    time: string;
    group: string;
    teacher: string;
    title: string;
    completed?: boolean;
};

const baseSchedule: ScheduleSeed[] = [
    { date: '2026-02-10', time: '10:30', group: 'ИВТ-301', teacher: 'Мария Громова', title: 'Базы данных, лекция' },
    { date: '2026-02-12', time: '12:20', group: 'ИВТ-302', teacher: 'Сергей Аникин', title: 'Java, практика' },
    { date: '2026-02-18', time: '09:00', group: 'ИВТ-303', teacher: 'Кирилл Титов', title: 'Алгоритмы, семинар' },
    { date: '2026-02-24', time: '14:00', group: 'ИВТ-304', teacher: 'Елена Сафина', title: 'Дипломный проект, консультация' },
    { date: '2026-03-03', time: '10:30', group: 'ИВТ-301', teacher: 'Мария Громова', title: 'SQL, лабораторная' },
    { date: '2026-03-10', time: '11:00', group: 'ИВТ-302', teacher: 'Сергей Аникин', title: 'Spring Boot, лекция' },
    { date: '2026-03-17', time: '16:20', group: 'ИВТ-303', teacher: 'Кирилл Титов', title: 'Структуры данных, практика' },
    { date: '2026-03-24', time: '13:00', group: 'ИВТ-304', teacher: 'Елена Сафина', title: 'Презентация проекта, семинар' },
    { date: '2026-04-07', time: '10:30', group: 'ИВТ-301', teacher: 'Мария Громова', title: 'Нормализация БД, практика' },
    { date: '2026-04-09', time: '14:00', group: 'ИВТ-302', teacher: 'Сергей Аникин', title: 'REST API, лабораторная' },
    { date: '2026-04-15', time: '09:00', group: 'ИВТ-303', teacher: 'Кирилл Титов', title: 'Контрольная по алгоритмам' },
    { date: '2026-04-21', time: '16:20', group: 'ИВТ-304', teacher: 'Елена Сафина', title: 'Предзащита проекта' },
    { date: '2026-05-04', time: '10:30', group: 'ИВТ-301', teacher: 'Мария Громова', title: 'Алгоритмы, практика' },
    { date: '2026-05-06', time: '14:00', group: 'ИВТ-302', teacher: 'Сергей Аникин', title: 'Консультация по Java' },
    { date: '2026-05-08', time: '09:00', group: 'ИВТ-301', teacher: 'Мария Громова', title: 'Базы данных, лабораторная' },
    { date: '2026-05-08', time: '16:20', group: 'ИВТ-303', teacher: 'Кирилл Титов', title: 'Разбор лабораторных', completed: true },
    { date: '2026-05-14', time: '11:00', group: 'ИВТ-304', teacher: 'Елена Сафина', title: 'Spring Boot, консультация' },
];

const examTeachers = [
    { name: 'Мария Громова', discipline: 'Базы данных' },
    { name: 'Сергей Аникин', discipline: 'Java и Spring' },
    { name: 'Кирилл Титов', discipline: 'Алгоритмы' },
    { name: 'Елена Сафина', discipline: 'Дипломный проект' },
] as const;
const examGroups = ['ИВТ-301', 'ИВТ-302', 'ИВТ-303', 'ИВТ-304'] as const;
const examDates = [
    ['2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05'],
    ['2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11'],
    ['2026-06-15', '2026-06-16', '2026-06-17', '2026-06-18'],
    ['2026-06-22', '2026-06-23', '2026-06-24', '2026-06-25'],
] as const;
const examTimes = ['09:00', '11:00', '13:30', '15:30'] as const;

const juneExamSchedule: ScheduleSeed[] = examTeachers.flatMap((teacher, teacherIndex) =>
    examGroups.map((group, groupIndex) => ({
        date: examDates[teacherIndex][groupIndex],
        time: examTimes[groupIndex],
        group,
        teacher: teacher.name,
        title: `Экзамен: ${teacher.discipline}`,
    })),
);

const isScheduleCompleted = (date: string) =>
    new Date(`${date}T23:59:59`).getTime() < Date.now();

const toScheduleRecord = (role: DashboardRole, schedule: ScheduleSeed[]) =>
    schedule.reduce<Record<string, TodoItem[]>>((acc, item, index) => {
        const task: TodoItem = {
            id: `${role}-schedule-${index + 1}`,
            title: role === 'teacher'
                ? `${item.group}, ${item.title}`
                : `${item.title}, ${item.teacher}, ${item.group}`,
            time: item.time,
            source: item.title.startsWith('Экзамен') ? 'exam' : 'schedule',
            completed: item.completed ?? isScheduleCompleted(item.date),
        };

        acc[item.date] = [...(acc[item.date] ?? []), task];

        return acc;
    }, {});

const scheduledByRole: Record<DashboardRole, Record<string, TodoItem[]>> = {
    student: toScheduleRecord('student', [...baseSchedule, ...juneExamSchedule]),
    teacher: toScheduleRecord('teacher', [...baseSchedule, ...juneExamSchedule]),
};

const roleCopy: Record<DashboardRole, { eyebrow: string; title: string; description: string; upcomingTitle: string }> = {
    student: {
        eyebrow: 'Студент',
        title: 'Календарь и задачи',
        description: 'Главная страница с расписанием, личными задачами и быстрым отметками выполнения.',
        upcomingTitle: 'Мои ближайшие занятия',
    },
    teacher: {
        eyebrow: 'Преподаватель',
        title: 'Календарь и задачи',
        description: 'Главная страница для занятий, консультаций и личного списка дел по выбранной дате.',
        upcomingTitle: 'Ближайшие занятия',
    },
};

const toDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
};

const todayKey = toDateKey(new Date());

const buildCalendarDays = (monthDate: Date): CalendarDay[] => {
    const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const startDate = new Date(firstDay);
    startDate.setDate(firstDay.getDate() - startOffset);

    return Array.from({ length: 42 }, (_, index) => {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + index);
        const key = toDateKey(date);

        return {
            date,
            key,
            day: date.getDate(),
            muted: date.getMonth() !== monthDate.getMonth(),
            today: key === todayKey,
        };
    });
};

const loadCustomTasks = (role: DashboardRole): Record<string, TodoItem[]> => {
    const rawTasks = localStorage.getItem(`${IS_DEMO ? 'demo:' : ''}calendarTasks:${role}`);

    if (!rawTasks) {
        return IS_DEMO ? createDemoTasks(role) : {};
    }

    try {
        const savedTasks = JSON.parse(rawTasks) as Record<string, TodoItem[]>;
        return IS_DEMO ? { ...createDemoTasks(role), ...savedTasks } : savedTasks;
    } catch {
        localStorage.removeItem(`${IS_DEMO ? 'demo:' : ''}calendarTasks:${role}`);
        return IS_DEMO ? createDemoTasks(role) : {};
    }
};

const saveCustomTasks = (role: DashboardRole, tasks: Record<string, TodoItem[]>) => {
    localStorage.setItem(`${IS_DEMO ? 'demo:' : ''}calendarTasks:${role}`, JSON.stringify(tasks));
};

const getCalendarColorStorageKey = (role: DashboardRole, userId?: number) =>
    `${IS_DEMO ? 'demo:' : ''}calendarColors:${userId ?? role}`;

const loadCalendarColors = (role: DashboardRole, userId?: number): CalendarColors => {
    const rawColors = localStorage.getItem(getCalendarColorStorageKey(role, userId));

    if (!rawColors) {
        return defaultCalendarColors;
    }

    try {
        const storedColors = JSON.parse(rawColors) as Partial<CalendarColors>;

        return {
            ...defaultCalendarColors,
            ...Object.fromEntries(
                calendarColorTargets
                    .filter((target) => typeof storedColors[target] === 'string')
                    .map((target) => [target, storedColors[target]]),
            ),
        } as CalendarColors;
    } catch {
        localStorage.removeItem(getCalendarColorStorageKey(role, userId));
        return defaultCalendarColors;
    }
};

const saveCalendarColors = (role: DashboardRole, userId: number | undefined, colors: CalendarColors) => {
    localStorage.setItem(getCalendarColorStorageKey(role, userId), JSON.stringify(colors));
};

const formatSelectedDate = (date: Date) =>
    new Intl.DateTimeFormat('ru-RU', {
        day: 'numeric',
        month: 'long',
        weekday: 'long',
    }).format(date);

interface CalendarDashboardProps {
    role: DashboardRole;
}

export const CalendarDashboard = ({ role }: CalendarDashboardProps) => {
    const user = tokenStorage.getUser();
    const schedule = IS_DEMO ? {} : scheduledByRole[role];
    const [calendarMonth, setCalendarMonth] = useState(initialMonthDate);
    const calendarDays = useMemo(() => buildCalendarDays(calendarMonth), [calendarMonth]);
    const initialDayIndex = Math.max(0, calendarDays.findIndex((day) => day.today));
    const [selectedDayIndex, setSelectedDayIndex] = useState(initialDayIndex);
    const [customTasks, setCustomTasks] = useState<Record<string, TodoItem[]>>(() => loadCustomTasks(role));
    const [calendarColors, setCalendarColors] = useState<CalendarColors>(() => loadCalendarColors(role, user?.id));
    const [taskTitle, setTaskTitle] = useState('');
    const [taskTime, setTaskTime] = useState('');
    const [taskReminderEnabled, setTaskReminderEnabled] = useState(false);
    const [taskReminderBefore, setTaskReminderBefore] = useState('30');
    const [taskReminderRepeat, setTaskReminderRepeat] = useState('none');
    const [viewMode, setViewMode] = useState<CalendarView>('month');
    const [apiEvents, setApiEvents] = useState<PlatformEvent[]>([]);
    const [apiPolls, setApiPolls] = useState<PollPreview[]>([]);

    useEffect(() => {
        let cancelled = false;

        Promise.all([eventsApi.list(), pollsApi.list()])
            .then(([events, polls]) => {
                if (cancelled) {
                    return;
                }

                setApiEvents(events);
                setApiPolls(polls);
            })
            .catch(() => {
                if (!cancelled) {
                    setApiEvents([]);
                    setApiPolls([]);
                }
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const selectedDay = calendarDays[selectedDayIndex] ?? calendarDays[initialDayIndex];
    const selectedKey = selectedDay.key;
    const apiScheduledByDay = useMemo(() => apiEvents.reduce<Record<string, TodoItem[]>>((acc, event) => {
        if (!event.dateKey) {
            return acc;
        }

        const task: TodoItem = {
            id: `api-event-${event.id}`,
            title: event.group ? `${event.group}, ${event.title}` : event.title,
            time: event.time,
            source: event.title.startsWith('Экзамен') ? 'exam' : 'schedule',
            completed: event.status === 'registered',
        };

        acc[event.dateKey] = [...(acc[event.dateKey] ?? []), task];
        return acc;
    }, {}), [apiEvents]);
    const scheduledTasks = [...(schedule[selectedKey] ?? []), ...(apiScheduledByDay[selectedKey] ?? [])];
    const dayCustomTasks = customTasks[selectedKey] ?? [];
    const selectedPollTasks: TodoItem[] = (apiPolls.length ? apiPolls : mockPolls)
        .filter((poll) => poll.status === 'active')
        .slice(0, 2)
        .map((poll) => ({
            id: `poll-${poll.id}`,
            title: poll.title,
            time: poll.deadline,
            source: 'poll',
            completed: false,
        }));
    const allTasks = calendarDays.flatMap((day) => [
        ...(schedule[day.key] ?? []),
        ...(apiScheduledByDay[day.key] ?? []),
        ...(customTasks[day.key] ?? []),
    ]);
    const weekTasks = calendarDays
        .slice(Math.max(0, selectedDayIndex - (selectedDayIndex % 7)), Math.max(0, selectedDayIndex - (selectedDayIndex % 7)) + 7)
        .flatMap((day) => [
            ...(schedule[day.key] ?? []).map((task) => ({ ...task, dateLabel: formatSelectedDate(day.date) })),
            ...(apiScheduledByDay[day.key] ?? []).map((task) => ({ ...task, dateLabel: formatSelectedDate(day.date) })),
            ...(customTasks[day.key] ?? []).map((task) => ({ ...task, dateLabel: formatSelectedDate(day.date) })),
        ]);
    const activePolls = (apiPolls.length ? apiPolls : mockPolls).filter((poll) => poll.status === 'active').length;
    const completedTasks = allTasks.filter((task) => task.completed).length;
    const copy = roleCopy[role];
    const monthTitle = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(calendarMonth);
    const weekStartIndex = Math.max(0, selectedDayIndex - (selectedDayIndex % 7));
    const visibleCalendarDays = viewMode === 'month'
        ? calendarDays
        : viewMode === 'week'
            ? calendarDays.slice(weekStartIndex, weekStartIndex + 7)
            : [selectedDay];

    const moveCalendar = (direction: -1 | 1) => {
        setCalendarMonth((current) => {
            const next = new Date(current);
            next.setMonth(current.getMonth() + direction);
            return next;
        });
        setSelectedDayIndex(0);
    };

    const updateCustomTasks = (nextTasks: Record<string, TodoItem[]>) => {
        setCustomTasks(nextTasks);
        saveCustomTasks(role, nextTasks);
    };

    const updateCalendarColor = (target: CalendarColorTarget, color: string) => {
        const nextColors = { ...calendarColors, [target]: color };

        setCalendarColors(nextColors);
        saveCalendarColors(role, user?.id, nextColors);
    };

    const getTaskColorStyle = (task: TodoItem): CSSProperties | undefined => {
        if (task.source !== 'custom' && task.source !== 'exam' && task.source !== 'schedule') {
            return undefined;
        }

        return { '--task-color': calendarColors[task.source] } as CSSProperties;
    };

    const addTask = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const trimmedTitle = taskTitle.trim();

        if (!trimmedTitle) {
            return;
        }

        const nextTask: TodoItem = {
            id: `custom-${crypto.randomUUID()}`,
            title: trimmedTitle,
            time: taskTime || 'Без времени',
            source: 'custom',
            completed: false,
        };
        const nextTasks = {
            ...customTasks,
            [selectedKey]: [...dayCustomTasks, nextTask],
        };

        updateCustomTasks(nextTasks);
        setTaskTitle('');
        setTaskTime('');
        setTaskReminderEnabled(false);
        setTaskReminderBefore('30');
        setTaskReminderRepeat('none');
    };

    const toggleTask = (task: TodoItem) => {
        if (task.source !== 'custom') {
            return;
        }

        const nextTasks = {
            ...customTasks,
            [selectedKey]: dayCustomTasks.map((item) =>
                item.id === task.id ? { ...item, completed: !item.completed } : item,
            ),
        };

        updateCustomTasks(nextTasks);
    };

    return (
        <section className="page-section calendar-home">
            <SectionHeader
                eyebrow={copy.eyebrow}
                title={copy.title}
                description={`${copy.description} ${user?.name ? `Аккаунт: ${user.name}.` : ''}`}
            />

            <div className="stats-grid">
                <StatCard eyebrow="Расписание" label="Занятий в месяце" value={String(allTasks.filter((task) => task.source === 'schedule' || task.source === 'exam').length)} hint="Все занятия из расписания отмечены в календаре." />
                <StatCard eyebrow="Задачи" label="Личные задачи" value={String(allTasks.filter((task) => task.source === 'custom').length)} hint="Задачи сохраняются отдельно для роли пользователя." />
                <StatCard eyebrow="Готово" label="Завершено" value={String(completedTasks)} hint="Личные задачи можно отмечать выполненными." />
                <StatCard eyebrow="Опросы" label="Активные опросы" value={String(activePolls)} hint="Опросы остаются доступны через верхнее меню." />
            </div>

            <div className="action-grid">
                <Card className="quick-link" hoverable>
                    <span className="eyebrow">Календарь</span>
                    <h2 className="quick-link__title">Календарь</h2>
                    <p>{role === 'teacher' ? 'Просматривайте расписание занятий и консультаций.' : 'Следите за занятиями и личными задачами.'}</p>
                </Card>
                <Card className="quick-link" hoverable>
                    <span className="eyebrow">Опросы</span>
                    <h2 className="quick-link__title">{role === 'teacher' ? 'Создать опрос' : 'Голосовать в опросе'}</h2>
                    <p>{role === 'teacher' ? 'Добавляйте варианты времени для группы.' : 'Выбирайте удобное время для занятия.'}</p>
                    <Link className="button button--secondary button--sm" to={ROUTES.POLLS}>
                        Перейти к опросам
                    </Link>
                </Card>
                {role === 'teacher' ? (
                    <Card className="quick-link" hoverable>
                        <span className="eyebrow">Занятия</span>
                        <h2 className="quick-link__title">Создать занятие</h2>
                        <p>Запланируйте очное или онлайн-занятие для студентов.</p>
                        <Link className="button button--secondary button--sm" to={ROUTES.EVENTS}>
                            К занятиям
                        </Link>
                    </Card>
                ) : null}
                <Card className="quick-link" hoverable>
                    <span className="eyebrow">Дела</span>
                    <h2 className="quick-link__title">Список дел</h2>
                    <p>Добавляйте личные задачи на выбранный день.</p>
                </Card>
            </div>

            <div className="calendar-workspace">
                <Card className="calendar-panel calendar-panel--main">
                    <div className="calendar-toolbar">
                        <div className="mini-stack">
                            <span className="eyebrow">Календарь</span>
                            <div className="calendar-title-row">
                                <Button size="sm" variant="ghost" onClick={() => moveCalendar(-1)} aria-label="Предыдущий месяц">←</Button>
                                <h2 className="calendar-title">{monthTitle}</h2>
                                <Button size="sm" variant="ghost" onClick={() => moveCalendar(1)} aria-label="Следующий месяц">→</Button>
                            </div>
                        </div>
                        <div className="pill-group">
                            {(Object.keys(viewLabels) as CalendarView[]).map((view) => (
                                <button
                                    type="button"
                                    className={`button ${viewMode === view ? 'button--primary' : 'button--ghost'} button--sm`}
                                    onClick={() => setViewMode(view)}
                                    key={view}
                                >
                                    {viewLabels[view]}
                                </button>
                            ))}
                        </div>
                    </div>

                    {viewMode !== 'day' ? (
                        <div className="calendar-weekdays">
                            {weekdayNames.map((dayName) => (
                                <div className="weekday" key={dayName}>{dayName}</div>
                            ))}
                        </div>
                    ) : null}

                    <div className={`calendar-grid calendar-grid--${viewMode}`}>
                        {visibleCalendarDays.map((day) => {
                            const index = calendarDays.findIndex((item) => item.key === day.key);
                            const tasks = [
                                ...(schedule[day.key] ?? []),
                                ...(apiScheduledByDay[day.key] ?? []),
                                ...(customTasks[day.key] ?? []),
                            ];

                            return (
                                <button
                                    type="button"
                                    key={day.key}
                                    className={`day-cell ${day.muted ? 'is-muted' : ''} ${day.today ? 'is-today' : ''} ${selectedDayIndex === index ? 'is-selected' : ''}`}
                                    onClick={() => setSelectedDayIndex(index)}
                                >
                                    <span className="day-number">{day.day}</span>
                                    <span className="day-cell__summary">
                                        {tasks.length ? `${tasks.length} задач` : 'Свободно'}
                                    </span>
                                    {tasks.slice(0, 2).map((task) => (
                                        <span
                                            className={`event-chip event-chip--${task.source} ${task.completed ? 'event-chip--done' : ''}`}
                                            key={task.id}
                                            style={getTaskColorStyle(task)}
                                        >
                                            <strong>{task.time}</strong>
                                            <span>{task.title}</span>
                                        </span>
                                    ))}
                                </button>
                            );
                        })}
                    </div>

                    {viewMode !== 'month' ? (
                        <div className="record-list">
                            {(viewMode === 'day'
                                ? [...scheduledTasks, ...dayCustomTasks].map((task) => ({ ...task, dateLabel: formatSelectedDate(selectedDay.date) }))
                                : weekTasks
                            ).map((task) => (
                                <div
                                    className={`record-item record-item--${task.source}`}
                                    key={`${task.id}-${task.dateLabel}`}
                                    style={getTaskColorStyle(task)}
                                >
                                    <span className="record-item__meta">{task.dateLabel} · {task.time}</span>
                                    <h3 className="record-item__title">{task.title}</h3>
                                </div>
                            ))}
                        </div>
                    ) : null}
                </Card>

                <aside className="todo-panel">
                    <Card className="list-card">
                        <span className="eyebrow">Цвета</span>
                        <h2 className="list-card__title">Цвета календаря</h2>
                        <div className="color-settings">
                            {calendarColorTargets.map((target) => (
                                <label className="color-setting" key={target}>
                                    <span>{calendarColorLabels[target]}</span>
                                    <input
                                        aria-label={calendarColorLabels[target]}
                                        type="color"
                                        value={calendarColors[target]}
                                        onChange={(event) => updateCalendarColor(target, event.target.value)}
                                    />
                                </label>
                            ))}
                        </div>
                    </Card>

                    <Card className="list-card">
                        <span className="eyebrow">Расписание</span>
                        <h2 className="list-card__title">Занятия на день</h2>

                        <div className="record-list">
                            {scheduledTasks.length ? (
                                scheduledTasks.map((task) => (
                                    <div
                                        className={`record-item record-item--${task.source}`}
                                        key={task.id}
                                        style={getTaskColorStyle(task)}
                                    >
                                        <span className="status-chip status-chip--active">Учебное занятие</span>
                                        <h3 className="record-item__title">{task.title}</h3>
                                        <p className="record-item__meta">{task.time}</p>
                                    </div>
                                ))
                            ) : (
                                <p className="subtle-text">На эту дату занятий нет.</p>
                            )}
                        </div>
                    </Card>

                    <Card className="list-card">
                        <span className="eyebrow">Дела</span>
                        <h2 className="list-card__title">Личные задачи</h2>

                        <div className="record-list">
                            {dayCustomTasks.length ? (
                                dayCustomTasks.map((task) => (
                                    <label
                                        className={`todo-item todo-item--personal ${task.completed ? 'todo-item--done' : ''}`}
                                        key={task.id}
                                        style={getTaskColorStyle(task)}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={task.completed}
                                            onChange={() => toggleTask(task)}
                                        />
                                        <span className="todo-item__body">
                                            <strong>{task.title}</strong>
                                            <span>{task.time} · Личная задача</span>
                                        </span>
                                    </label>
                                ))
                            ) : (
                                <p className="subtle-text">Личных задач на выбранную дату пока нет.</p>
                            )}
                        </div>

                        <form className="todo-form" onSubmit={addTask}>
                            <Input
                                label="Новая задача"
                                value={taskTitle}
                                onChange={(event) => setTaskTitle(event.target.value)}
                                placeholder="Например, подготовить материалы"
                            />
                            <Input
                                label="Время (необязательно)"
                                type="time"
                                value={taskTime}
                                onChange={(event) => setTaskTime(event.target.value)}
                            />
                            <div className="reminder-box">
                                <label className="check-item">
                                    <input
                                        type="checkbox"
                                        checked={taskReminderEnabled}
                                        onChange={(event) => setTaskReminderEnabled(event.target.checked)}
                                    />
                                    <span>Добавить напоминание</span>
                                </label>
                                {taskReminderEnabled ? (
                                    <div className="form-grid">
                                        <Select
                                            label="За сколько"
                                            value={taskReminderBefore}
                                            onChange={(event) => setTaskReminderBefore(event.target.value)}
                                        >
                                            <option value="10">За 10 минут</option>
                                            <option value="30">За 30 минут</option>
                                            <option value="60">За 1 час</option>
                                            <option value="1440">За 1 день</option>
                                        </Select>
                                        <Select
                                            label="Повтор"
                                            value={taskReminderRepeat}
                                            onChange={(event) => setTaskReminderRepeat(event.target.value)}
                                        >
                                            <option value="none">Не повторять</option>
                                            <option value="daily">Каждый день</option>
                                            <option value="weekly">Каждую неделю</option>
                                        </Select>
                                    </div>
                                ) : null}
                            </div>
                            <Button type="submit" fullWidth>Добавить</Button>
                        </form>
                    </Card>

                    <Card className="list-card">
                        <span className="eyebrow">Опросы</span>
                        <h2 className="list-card__title">Ожидают действия</h2>
                        <div className="record-list">
                            {selectedPollTasks.map((task) => (
                                <div className="record-item record-item--poll" key={task.id}>
                                    <span className="status-chip status-chip--warning">Опрос</span>
                                    <h3 className="record-item__title">{task.title}</h3>
                                    <p className="record-item__meta">Дедлайн: <span className="deadline-text">{task.time}</span></p>
                                </div>
                            ))}
                        </div>
                    </Card>

                    <Card className="list-card">
                        <h2 className="list-card__title">{copy.upcomingTitle}</h2>
                        <div className="record-list">
                            {allTasks.filter((task) => !IS_DEMO || (!task.completed && task.source !== 'custom')).slice(0, 4).map((task) => (
                                <div
                                    className={`record-item record-item--${task.source}`}
                                    key={`${task.id}-upcoming`}
                                    style={getTaskColorStyle(task)}
                                >
                                    <span className={`status-chip ${task.completed ? 'status-chip--closed' : 'status-chip--active'}`}>
                                        {task.completed ? 'Готово' : 'В работе'}
                                    </span>
                                    <h3 className="record-item__title">{task.title}</h3>
                                    <p className="record-item__meta">{task.time}</p>
                                </div>
                            ))}
                        </div>
                    </Card>
                </aside>
            </div>
        </section>
    );
};
