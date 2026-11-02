import { AxiosError, AxiosHeaders } from 'axios';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import type { CreateAdminUserPayload, BackendUser, UpdateUserPayload } from '../api/users.api';
import type { CreateGroupPayload, UpdateGroupPayload } from '../api/groups.api';
import type { CreatePollPayload } from '../api/polls.api';
import type { CreateEventPayload } from '../api/events.api';
import { tokenStorage } from '../lib/token-storage';
import type { UserRole } from '../types/user';
import { createDemoData, demoPersonaIds } from './data';
import type { DemoPoll } from './data';

// One in-memory store is shared by all existing API modules and role interfaces.
// Reloading restores the fixture; changing pages or roles keeps the changes.
const data = createDemoData();
const nextId = (items: Array<{ id: number }>) => Math.max(0, ...items.map((item) => item.id)) + 1;
const requireValue = <T,>(value: T | null | undefined, message = 'Запись не найдена'): T => {
    if (value == null) throw new DemoError(message, 404);
    return value;
};
class DemoError extends Error {
    status: number;
    constructor(message: string, status = 400) {
        super(message);
        this.status = status;
    }
}

export const getDemoUser = (role: UserRole): BackendUser => ({
    ...requireValue(data.users.find((user) => user.id === demoPersonaIds[role])),
});

const withGroup = (user: BackendUser) => ({ ...user, group: data.groups.find((group) => group.id === user.groupId) ?? null });
const serializePoll = (poll: DemoPoll) => ({
    ...poll,
    teacher: data.users.find((user) => user.id === poll.teacherId),
    targetGroups: data.groups.filter((group) => poll.targetGroupIds.includes(group.id)),
    participantsCount: poll.participantStudentIds.length,
    votesCount: poll.votes.length,
});
const serializeEvent = (event: (typeof data.events)[number]) => ({
    ...event, teacher: data.users.find((user) => user.id === event.teacherId),
    group: data.groups.find((group) => group.id === event.groupId),
});

const readBody = <T,>(config: InternalAxiosRequestConfig): T =>
    (typeof config.data === 'string' ? JSON.parse(config.data) : config.data ?? {}) as T;

const handleRequest = (config: InternalAxiosRequestConfig): unknown => {
    const method = config.method?.toUpperCase() ?? 'GET';
    const path = config.url ?? '/';
    const user = requireValue(tokenStorage.getUser(), 'Сначала выберите роль для просмотра демо');
    const allow = (...roles: UserRole[]) => {
        if (!roles.includes(user.role)) throw new DemoError('Действие недоступно для выбранной роли', 403);
    };
    const canReadPoll = (poll: DemoPoll) => user.role === 'admin' ||
        (user.role === 'teacher' ? poll.teacherId === user.id : poll.status !== 'draft' && poll.participantStudentIds.includes(user.id));
    const visibleGroups = () => data.groups.filter((group) => user.role === 'admin' ||
        (user.role === 'teacher' ? group.teacherId === user.id : group.id === user.groupId));
    const getPoll = (id: number) => {
        const poll = requireValue(data.polls.find((item) => item.id === id));
        if (!canReadPoll(poll)) throw new DemoError('Опрос недоступен для выбранной роли', 403);
        return poll;
    };

    if (method === 'GET' && path === '/admin/stats') {
        allow('admin');
        return { stats: {
            studentsCount: data.users.filter((item) => item.role === 'student').length,
            teachersCount: data.users.filter((item) => item.role === 'teacher').length,
            groupsCount: data.groups.length, pollsCount: data.polls.length, eventsCount: data.events.length,
        } };
    }
    if (path === '/admin/import-diploma' || path === '/users/change-password' || path.startsWith('/auth/')) {
        throw new DemoError('В демо вход выполняется выбором роли. Импорт файлов и смена пароля доступны в полной версии.');
    }
    if (path === '/users') {
        allow('admin');
        if (method === 'GET') {
            const params = (config.params ?? {}) as { role?: UserRole; groupId?: number; isActive?: boolean; search?: string };
            return { users: data.users.filter((item) =>
                (!params.role || item.role === params.role) &&
                (params.groupId == null || item.groupId === Number(params.groupId)) &&
                (params.isActive == null || item.isActive === params.isActive) &&
                (!params.search || `${item.name} ${item.email}`.toLowerCase().includes(params.search.toLowerCase())),
            ).map(withGroup) };
        }
        if (method === 'POST') {
            const body = readBody<CreateAdminUserPayload>(config);
            if (!body.name?.trim() || !body.email?.trim()) throw new DemoError('Заполните имя и почту');
            if (data.users.some((item) => item.email === body.email)) throw new DemoError('Пользователь с такой почтой уже существует');
            const created: BackendUser = {
                id: nextId(data.users), name: body.name.trim(), email: body.email.trim(), role: body.role,
                groupId: body.role === 'student' ? body.groupId : null, isActive: true, createdAt: new Date().toISOString(),
            };
            // Passwords from the retained admin form are deliberately not stored.
            data.users.push(created);
            return { user: withGroup(created) };
        }
    }
    const userMatch = path.match(/^\/users\/(\d+)$/);
    if (userMatch && (method === 'PATCH' || method === 'DELETE')) {
        allow('admin');
        const target = requireValue(data.users.find((item) => item.id === Number(userMatch[1])));
        if (method === 'PATCH') {
            const body = readBody<UpdateUserPayload>(config);
            if (Object.values(demoPersonaIds).includes(target.id) && ((body.role && body.role !== target.role) || body.isActive === false)) {
                throw new DemoError('Сохраните роль и активность стартового демо-профиля. Для проверки используйте другого пользователя.');
            }
            if (body.email && data.users.some((item) => item.id !== target.id && item.email === body.email)) throw new DemoError('Эта почта уже используется');
            Object.assign(target, body);
            if (target.role !== 'student') target.groupId = null;
            return { user: withGroup(target) };
        }
        if (Object.values(demoPersonaIds).includes(target.id)) throw new DemoError('Стартовый демо-профиль нужен для переключения ролей. Можно удалить другого пользователя.');
        data.users = data.users.filter((item) => item.id !== target.id);
        data.polls.forEach((poll) => {
            poll.participantStudentIds = poll.participantStudentIds.filter((id) => id !== target.id);
            poll.votes = poll.votes.filter((vote) => vote.studentId !== target.id);
        });
        return {};
    }

    if (method === 'GET' && path === '/groups/teaching-disciplines') {
        allow('teacher');
        return { disciplines: ['Базы данных', 'Веб-разработка'] };
    }
    if (method === 'GET' && path === '/groups/by-discipline') {
        allow('teacher');
        return { groups: visibleGroups() };
    }
    if (path === '/groups') {
        if (method === 'GET') return { groups: visibleGroups() };
        if (method === 'POST') {
            allow('admin');
            const body = readBody<CreateGroupPayload>(config);
            if (!body.name?.trim()) throw new DemoError('Укажите название группы');
            const group = { id: nextId(data.groups), ...body };
            data.groups.push(group);
            return { group };
        }
    }
    const groupMatch = path.match(/^\/groups\/(\d+)(?:\/students(?:\/(\d+))?)?$/);
    if (groupMatch) {
        const group = requireValue(data.groups.find((item) => item.id === Number(groupMatch[1])));
        if (method === 'PATCH' && !path.includes('/students')) {
            allow('admin');
            Object.assign(group, readBody<UpdateGroupPayload>(config));
            return { group };
        }
        if (path.includes('/students')) {
            if (method === 'GET') {
                if (!visibleGroups().some((item) => item.id === group.id)) throw new DemoError('Группа недоступна', 403);
                return { students: data.users.filter((item) => item.role === 'student' && item.groupId === group.id).map(withGroup) };
            }
            allow('admin');
            const studentId = method === 'POST' ? readBody<{ studentId: number }>(config).studentId : Number(groupMatch[2]);
            const student = requireValue(data.users.find((item) => item.id === studentId && item.role === 'student'));
            if (method === 'POST') {
                student.groupId = group.id;
                return { groupStudent: withGroup(student) };
            }
            if (method === 'DELETE') {
                student.groupId = null;
                return {};
            }
        }
    }

    if (path === '/events') {
        if (method === 'GET') return { events: data.events.filter((event) => user.role === 'admin' ||
            (user.role === 'teacher' ? event.teacherId === user.id : event.groupId === user.groupId))
            .sort((left, right) => Number(left.status === 'completed') - Number(right.status === 'completed') || Date.parse(left.startAt) - Date.parse(right.startAt))
            .map(serializeEvent) };
        if (method === 'POST') {
            allow('teacher', 'admin');
            const body = readBody<CreateEventPayload>(config);
            if (!body.title?.trim() || !Number.isFinite(Date.parse(body.startAt)) || Date.parse(body.endAt) <= Date.parse(body.startAt)) throw new DemoError('Проверьте название и время занятия');
            const event = { ...body, id: nextId(data.events), teacherId: user.role === 'teacher' ? user.id : body.teacherId ?? 201, status: 'scheduled' as const };
            data.events.push(event);
            return { event: serializeEvent(event) };
        }
    }
    if (method === 'GET' && path === '/notifications/me') {
        return { notifications: data.notifications.filter((notification) => notification.userId === user.id) };
    }
    const notificationMatch = path.match(/^\/notifications\/(\d+)\/read$/);
    if (notificationMatch && method === 'PATCH') {
        const notification = requireValue(data.notifications.find((item) => item.id === Number(notificationMatch[1]) && item.userId === user.id));
        notification.readAt = new Date().toISOString();
        return {};
    }

    if (path === '/polls') {
        if (method === 'GET') return { polls: data.polls.filter(canReadPoll).map(serializePoll) };
        if (method === 'POST') {
            allow('teacher');
            const body = readBody<CreatePollPayload>(config);
            if (!body.title?.trim() || body.options.length < 2) throw new DemoError('Укажите название и хотя бы два варианта времени');
            const id = nextId(data.polls);
            const poll: DemoPoll = {
                ...body, id, teacherId: user.id, status: 'draft', votes: [],
                options: body.options.map((option, index) => ({ ...option, id: id * 1000 + index })),
                participantStudentIds: body.participantStudentIds ?? data.users.filter((item) => item.role === 'student' && body.targetGroupIds.includes(item.groupId ?? 0)).map((item) => item.id),
            };
            data.polls.push(poll);
            return { poll: serializePoll(poll) };
        }
    }
    const pollMatch = path.match(/^\/polls\/(\d+)(?:\/(activate|recommendations|approve-result))?$/);
    if (pollMatch) {
        const poll = getPoll(Number(pollMatch[1]));
        if (method === 'GET' && !pollMatch[2]) return { poll: serializePoll(poll) };
        allow('teacher', 'admin');
        if (method === 'PATCH' && pollMatch[2] === 'activate') {
            poll.status = 'active';
            return { poll: serializePoll(poll) };
        }
        if (method === 'GET' && pollMatch[2] === 'recommendations') {
            const participantsCount = poll.participantStudentIds.length;
            const recommendations = poll.options.map((option, index) => {
                const votesCount = poll.votes.filter((vote) => vote.optionId === option.id).length;
                const votesShare = participantsCount ? votesCount / participantsCount : 0;
                const conflict = index === 2;
                return {
                    optionId: option.id, startAt: option.startAt, endAt: option.endAt,
                    durationMinutes: (Date.parse(option.endAt) - Date.parse(option.startAt)) / 60000,
                    votesCount, participantsCount, votesShare, dynamicPmin: 0.5,
                    minVotesRequired: Math.ceil(participantsCount * 0.5), passedThreshold: votesShare >= 0.5,
                    thresholdExplanation: 'Демонстрационный порог поддержки — половина участников.',
                    teacherAvailable: true, groupAvailable: !conflict, studentsAvailable: !conflict,
                    teacherAvailabilityScore: 1, groupAvailabilityScore: conflict ? 0.3 : 1,
                    convenienceScore: 0.85, durationScore: 1, finalScore: votesShare * 0.7 + (conflict ? 0.05 : 0.3),
                    recommendationStatus: conflict ? 'conflict' : votesShare >= 0.5 ? 'recommended' : 'low_support',
                    warnings: conflict ? ['У группы запланировано другое занятие.'] : [],
                    explanation: 'Демонстрационная оценка по тестовым голосам и условной доступности группы.',
                    conflicts: { hasAnyConflict: conflict, teacher: false, groupIds: conflict ? poll.targetGroupIds : [], studentsCount: conflict ? 2 : 0 },
                };
            }).sort((left, right) => right.finalScore - left.finalScore).map((item, index) => ({ ...item, rank: index + 1 }));
            return { recommendations };
        }
        if (method === 'POST' && pollMatch[2] === 'approve-result') {
            if (poll.status !== 'closed' || poll.approvedOptionId) throw new DemoError('Согласовать можно закрытый опрос без утверждённого результата');
            const option = requireValue(poll.options.find((item) => item.id === readBody<{ optionId: number }>(config).optionId));
            poll.approvedOptionId = option.id;
            poll.targetGroupIds.forEach((groupId) => data.events.push({
                id: nextId(data.events), title: `${poll.discipline} · ${poll.title}`, lessonType: poll.lessonType,
                description: poll.description, teacherId: poll.teacherId, groupId, startAt: option.startAt,
                endAt: option.endAt, format: option.format, location: option.location, status: 'scheduled',
            }));
            return { poll: serializePoll(poll) };
        }
    }
    if (method === 'POST' && path === '/votes') {
        allow('student');
        const body = readBody<{ pollId: number; optionIds: number[] }>(config);
        const poll = getPoll(body.pollId);
        if (poll.status !== 'active') throw new DemoError('Голосование завершено');
        if (body.optionIds.some((id) => !poll.options.some((option) => option.id === id))) throw new DemoError('Вариант времени не найден');
        poll.votes = poll.votes.filter((vote) => vote.studentId !== user.id);
        [...new Set(body.optionIds)].forEach((optionId) => poll.votes.push({ optionId, studentId: user.id }));
        return {};
    }
    const voteMatch = path.match(/^\/votes\/polls\/(\d+)\/my$/);
    if (voteMatch && method === 'DELETE') {
        allow('student');
        const poll = getPoll(Number(voteMatch[1]));
        if (poll.status !== 'active') throw new DemoError('Голосование завершено');
        poll.votes = poll.votes.filter((vote) => vote.studentId !== user.id);
        return {};
    }
    // Never delegate unknown routes to Axios' HTTP/XHR/fetch adapters.
    throw new DemoError(`В демо не предусмотрено действие ${method} ${path}`, 501);
};

export const demoAdapter: AxiosAdapter = async (config) => {
    try {
        // Copy responses so React state cannot accidentally mutate the fixture store.
        return { data: structuredClone(handleRequest(config)), status: 200, statusText: 'OK', headers: new AxiosHeaders(), config };
    } catch (error) {
        const status = error instanceof DemoError ? error.status : 400;
        const message = error instanceof Error ? error.message : 'Ошибка демонстрационных данных';
        const response = { data: { message }, status, statusText: 'Demo error', headers: new AxiosHeaders(), config };
        throw new AxiosError(message, AxiosError.ERR_BAD_REQUEST, config, undefined, response);
    }
};
