import type { BackendUser } from '../api/users.api';
import type { StudyGroup, CreatePollPayload } from '../api/polls.api';
import type { CreateEventPayload } from '../api/events.api';
import type { AppNotification } from '../api/notifications.api';
import type { UserRole } from '../types/user';

// Dates are relative to the visit, so the calendar stays populated in a portfolio.
const visitDate = new Date();
export const demoDate = (days: number, hour = 10, minute = 0) => {
    const date = new Date(visitDate);
    date.setDate(date.getDate() + days);
    date.setHours(hour, minute, 0, 0);
    return date.toISOString();
};

export const demoDateKey = (value: string) => {
    const date = new Date(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export interface DemoPoll extends CreatePollPayload {
    id: number;
    teacherId: number;
    status: 'draft' | 'active' | 'closed';
    options: Array<CreatePollPayload['options'][number] & { id: number }>;
    votes: Array<{ studentId: number; optionId: number }>;
    participantStudentIds: number[];
    approvedOptionId?: number;
}

export interface DemoEvent extends CreateEventPayload {
    id: number;
    teacherId: number;
    status: 'scheduled' | 'completed' | 'cancelled';
}

export interface DemoTask {
    id: string;
    title: string;
    time: string;
    source: 'custom';
    completed: boolean;
}

export const demoPersonaIds: Record<UserRole, number> = { student: 101, teacher: 201, admin: 301 };

export const createDemoData = () => {
    const groups: StudyGroup[] = [
        { id: 1, name: 'ИВТ-301', description: 'Информатика и вычислительная техника, 3 курс', teacherId: 201 },
        { id: 2, name: 'ИВТ-302', description: 'Разработка программных систем, 3 курс', teacherId: 201 },
        { id: 3, name: 'ПИ-401', description: 'Программная инженерия, выпускной курс', teacherId: 202 },
    ];
    const studentNames = ['Алина Соколова', 'Даниил Волков', 'Софья Кузнецова', 'Михаил Орлов', 'Анна Лебедева', 'Артём Морозов', 'Полина Новикова', 'Илья Васильев', 'Виктория Павлова', 'Максим Смирнов', 'Елизавета Попова', 'Александр Петров', 'Дарья Иванова', 'Кирилл Фёдоров', 'Анастасия Белова', 'Никита Егоров', 'Варвара Михайлова', 'Роман Андреев'];
    const users: BackendUser[] = [
        ...studentNames.map((name, index) => ({
            id: 101 + index, name, email: `student${index + 1}@example.com`, role: 'student' as const,
            groupId: Math.floor(index / 6) + 1, isActive: index !== 17, createdAt: demoDate(-60),
        })),
        { id: 119, name: 'Андрей Захаров', email: 'student19@example.com', role: 'student', groupId: null, isActive: true },
        { id: 201, name: 'Мария Громова', email: 'gromova@example.com', role: 'teacher', isActive: true },
        { id: 202, name: 'Сергей Аникин', email: 'anikin@example.com', role: 'teacher', isActive: true },
        { id: 203, name: 'Елена Сафина', email: 'safina@example.com', role: 'teacher', isActive: true },
        { id: 301, name: 'Ольга Миронова', email: 'admin@example.com', role: 'admin', isActive: true },
    ];

    const pollSeeds: Array<{ title: string; discipline: string; description: string; teacherId: number; groupId: number; day: number; status: DemoPoll['status'] }> = [
        { title: 'Консультация перед лабораторной', discipline: 'Базы данных', description: 'Разберём нормализацию, индексы и сложные SQL-запросы. Отметьте все удобные варианты.', teacherId: 201, groupId: 1, day: 4, status: 'active' },
        { title: 'Практикум по REST API', discipline: 'Веб-разработка', description: 'Спроектируем API учебного сервиса и обсудим обработку ошибок.', teacherId: 201, groupId: 1, day: 6, status: 'active' },
        { title: 'Разбор курсовых проектов', discipline: 'Базы данных', description: 'Выберем время для обсуждения схем и результатов курсовой работы.', teacherId: 201, groupId: 2, day: 8, status: 'active' },
        { title: 'Подготовка к защите', discipline: 'Программная инженерия', description: 'Репетиция выступления и ответы на вопросы комиссии.', teacherId: 202, groupId: 3, day: 7, status: 'active' },
        { title: 'Разбор контрольной работы', discipline: 'Базы данных', description: 'Голосование завершено. Преподаватель может согласовать итоговое занятие.', teacherId: 201, groupId: 1, day: 3, status: 'closed' },
        { title: 'Встреча проектной команды', discipline: 'Веб-разработка', description: 'Черновик встречи для обсуждения промежуточных результатов.', teacherId: 201, groupId: 2, day: 10, status: 'draft' },
    ];
    const polls: DemoPoll[] = pollSeeds.map((seed, index) => {
        const id = index + 1;
        const participantStudentIds = users.filter((user) => user.role === 'student' && user.groupId === seed.groupId && user.isActive).map((user) => user.id);
        const options = [0, 1, 2].map((offset) => ({
            id: id * 10 + offset + 1, startAt: demoDate(seed.day + offset, offset === 1 ? 14 : 10),
            endAt: demoDate(seed.day + offset, offset === 1 ? 15 : 11, 30), format: 'OFFLINE' as const,
            location: offset === 1 ? 'Аудитория 312' : 'Аудитория 204',
        }));
        return {
            id, title: seed.title, discipline: seed.discipline, description: seed.description,
            lessonType: 'консультация', teacherId: seed.teacherId, targetGroupIds: [seed.groupId],
            deadlineAt: demoDate(seed.status === 'closed' ? -1 : seed.day - 1, 18), status: seed.status,
            options, participantStudentIds,
            votes: seed.status === 'draft' ? [] : participantStudentIds.flatMap((studentId, voterIndex) =>
                options.filter((_, optionIndex) => optionIndex === 0 || (optionIndex === 1 && voterIndex % 2 === 0))
                    .map((option) => ({ studentId, optionId: option.id }))),
        };
    });
    const eventTitles = ['Базы данных · Индексы и оптимизация запросов', 'Веб-разработка · Компоненты React', 'Алгоритмы · Поиск и сортировка', 'Консультация по курсовому проекту', 'Экзамен: Базы данных', 'Проектный семинар · Демонстрация прототипов'];
    const events: DemoEvent[] = Array.from({ length: 24 }, (_, index) => {
        const day = Math.floor(index / 2) - 2;
        const groupId = index % 2 === 0 ? 1 : index % 3 + 1;
        const hour = index % 2 === 0 ? 10 : 14;
        return {
            id: index + 1, title: eventTitles[index % eventTitles.length], lessonType: 'семинар',
            description: 'Обсуждение учебных материалов, практическая работа и ответы на вопросы. Материалы к занятию подготовлены в учебной группе.',
            teacherId: groupId === 3 ? 202 : 201, groupId,
            startAt: demoDate(day, hour), endAt: demoDate(day, hour + 1, 30),
            format: index % 4 === 0 ? 'ONLINE' : 'OFFLINE',
            location: `Аудитория ${204 + index % 5}`, link: index % 4 === 0 ? 'https://example.com/demo-lesson' : null,
            status: day < 0 ? 'completed' : 'scheduled',
        };
    });

    const notifications: Array<AppNotification & { userId: number }> = users.flatMap((user) => [
        { category: 'poll', type: 'POLL_CREATED', title: 'Открыто голосование', message: 'Выберите время консультации по базам данных. Доступны три варианта времени.' },
        { category: 'event', type: 'SCHEDULE_REMINDER', title: 'Ближайшее занятие', message: 'Проверьте обновлённое расписание занятий и консультаций.' },
        { category: 'task', type: 'TASK_REMINDER', title: 'Материалы к занятию', message: user.role === 'teacher' ? 'Подготовьте задания для практикума по REST API.' : 'Завершите практическую работу и подготовьте вопросы к консультации.' },
        { category: 'system', type: 'SYSTEM', title: 'Расписание обновлено', message: 'Учебные группы и расписание на ближайшую неделю актуализированы.' },
        { category: 'poll', type: 'POLL_VOTED', title: 'Результаты голосования', message: 'В опросах появились новые голоса. Откройте опрос, чтобы посмотреть распределение.' },
    ].map((item, index) => ({
        id: user.id * 10 + index, userId: user.id, category: item.category, type: item.type,
        status: 'SENT' as const, createdAt: demoDate(-index, 9), readAt: index > 2 ? demoDate(-index, 12) : null,
        payload: { title: item.title, message: item.message },
    })));

    return { users, groups, polls, events, notifications };
};

export const createDemoTasks = (role: 'student' | 'teacher'): Record<string, DemoTask[]> => ({
    [demoDateKey(demoDate(0))]: [
        { id: `demo-${role}-1`, title: role === 'teacher' ? 'Проверить лабораторные работы ИВТ-301' : 'Завершить лабораторную по SQL', time: '16:00', source: 'custom', completed: false },
        { id: `demo-${role}-2`, title: role === 'teacher' ? 'Подготовить материалы к консультации' : 'Прочитать материалы к практикуму', time: '09:00', source: 'custom', completed: true },
    ],
    [demoDateKey(demoDate(1))]: [
        { id: `demo-${role}-3`, title: role === 'teacher' ? 'Обсудить курсовые проекты с группой' : 'Подготовить презентацию курсового проекта', time: '17:30', source: 'custom', completed: false },
    ],
});
