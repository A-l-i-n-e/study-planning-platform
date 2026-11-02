import type { PlatformEvent } from '@/shared/types/event';
import type { PollDetails } from '@/shared/types/poll';
import type { PlatformUser, UserProfile } from '@/shared/types/user';

export const mockPolls: PollDetails[] = [
    {
        id: '1',
        title: 'Консультация по базам данных',
        description: 'Выберите удобное время для дополнительной консультации перед сдачей лабораторной работы.',
        teacher: 'Мария Громова',
        group: 'ИВТ-301',
        deadline: '28 мая, 18:00',
        status: 'active',
        optionsCount: 3,
        isMine: true,
        options: [
            { id: 'p1o1', label: 'Вариант 1', date: '29 мая', time: '10:00 – 11:30', location: '', votesCount: 17 },
            { id: 'p1o2', label: 'Вариант 2', date: '30 мая', time: '15:00 – 16:30', location: '', votesCount: 11 },
            { id: 'p1o3', label: 'Вариант 3', date: '2 июня', time: '12:30 – 14:00', location: '', votesCount: 8 },
        ],
    },
    {
        id: '2',
        title: 'Дополнительное занятие по Java',
        description: 'Нужно согласовать практику по коллекциям и потокам перед модульной неделей.',
        teacher: 'Сергей Аникин',
        group: 'ИВТ-302',
        deadline: '30 мая, 12:00',
        status: 'active',
        optionsCount: 4,
        options: [
            { id: 'p2o1', label: 'Вариант 1', date: '1 июня', time: '09:00 – 10:30', location: '', votesCount: 14 },
            { id: 'p2o2', label: 'Вариант 2', date: '1 июня', time: '16:00 – 17:30', location: '', votesCount: 18 },
            { id: 'p2o3', label: 'Вариант 3', date: '3 июня', time: '11:00 – 12:30', location: '', votesCount: 6 },
            { id: 'p2o4', label: 'Вариант 4', date: '4 июня', time: '13:00 – 14:30', location: '', votesCount: 10 },
        ],
    },
    {
        id: '3',
        title: 'Подготовка к защите проекта',
        description: 'Финальный слот для разбора презентаций и структуры выступления.',
        teacher: 'Елена Сафина',
        group: 'ИВТ-304',
        deadline: '22 апреля, 21:00',
        status: 'closed',
        optionsCount: 2,
        options: [
            { id: 'p3o1', label: 'Вариант 1', date: '23 апреля', time: '13:00 – 14:00', location: '', votesCount: 9 },
            { id: 'p3o2', label: 'Вариант 2', date: '24 апреля', time: '17:00 – 18:00', location: '', votesCount: 19 },
        ],
    },
    {
        id: '4',
        title: 'Разбор контрольной по алгоритмам',
        description: 'Черновой опрос для выбора времени открытого разбора задач повышенной сложности.',
        teacher: 'Кирилл Титов',
        group: 'ИВТ-303',
        deadline: '27 мая, 10:00',
        status: 'draft',
        optionsCount: 3,
        options: [
            { id: 'p4o1', label: 'Вариант 1', date: '28 мая', time: '11:00 – 12:30', location: '', votesCount: 0 },
            { id: 'p4o2', label: 'Вариант 2', date: '28 мая', time: '15:30 – 17:00', location: '', votesCount: 0 },
            { id: 'p4o3', label: 'Вариант 3', date: '29 мая', time: '10:30 – 12:00', location: '', votesCount: 0 },
        ],
    },
];

export const mockEvents: PlatformEvent[] = [
    {
        id: 'event-1',
        title: 'Разбор лабораторной работы',
        teacher: 'Мария Громова',
        group: 'ИВТ-301',
        dateKey: '2026-05-29',
        date: '29 мая',
        time: '10:00 – 11:30',
        format: 'offline',
        place: '',
        status: 'registered',
        description: 'Практический разбор сложных SQL-запросов и структуры отчёта.',
    },
    {
        id: 'event-2',
        title: 'Консультация по дипломному проекту',
        teacher: 'Елена Сафина',
        group: 'ИВТ-304',
        dateKey: '2026-05-30',
        date: '30 мая',
        time: '16:00 – 17:00',
        format: 'online',
        place: '',
        status: 'open',
        description: 'Индивидуальные вопросы по архитектуре и презентации дипломной работы.',
    },
    {
        id: 'event-3',
        title: 'Практика по Spring Boot',
        teacher: 'Сергей Аникин',
        group: 'ИВТ-302',
        dateKey: '2026-06-02',
        date: '2 июня',
        time: '12:30 – 14:00',
        format: 'offline',
        place: '',
        status: 'registered',
        description: 'Настройка REST API, валидации и базовой авторизации в учебном проекте.',
    },
    {
        id: 'event-4',
        title: 'Открытая встреча с куратором группы',
        teacher: 'Ольга Мещерякова',
        group: 'ИВТ-303',
        dateKey: '2026-06-03',
        date: '3 июня',
        time: '18:00 – 19:00',
        format: 'online',
        place: '',
        status: 'waitlist',
        description: 'Обсуждение учебной нагрузки, дедлайнов и распределения задач по командам.',
    },
];

export const mockUsers: PlatformUser[] = [
    { id: 'u1', name: 'Алина Иванова', email: 'alinai@example.com', role: 'student', group: 'ИВТ-301', status: 'active' },
    { id: 'u2', name: 'Роман Гусев', email: 'gusev.r@example.com', role: 'student', group: 'ИВТ-302', status: 'review' },
    { id: 'u3', name: 'Мария Громова', email: 'm.gromova@example.com', role: 'teacher', status: 'active' },
    { id: 'u4', name: 'Сергей Аникин', email: 'anikin.s@example.com', role: 'teacher', status: 'active' },
    { id: 'u5', name: 'Нина Белова', email: 'n.belova@example.com', role: 'admin', status: 'offline' },
];

export const mockProfile: UserProfile = {
    name: 'Алина Иванова',
    email: 'alinai@example.com',
    role: 'student',
    group: 'ИВТ-301',
    phone: '+7 (999) 123-45-67',
    status: 'Активный участник платформы',
    activity: {
        lessons: 12,
        polls: 7,
        nearestLesson: '29 мая · 10:00 · Базы данных',
    },
};
