import { prisma } from "../config/prisma";
import {
    CreateEventDto,
    CreateEventFromPollDto,
    DeleteEventDto,
    EventFilterDto,
    GetEventDto,
    UpdateEventDto,
} from "../schemas/event.schema";
import { AppError } from "../errors/app-error";
import {
    events_status,
    polls_status,
    users_role,
} from "../../generated/prisma/enums";
import { NotificationHelperService } from "./notification-helper.service";
import type { AuthUser } from "../midllewares/user.middleware";

export class EventService {
    private notificationHelper = new NotificationHelperService();

    async create(currentUser: AuthUser, data: CreateEventDto) {
        let teacherId: number;

        if (data.pollId) {
            const poll = await this.getWritablePoll(currentUser, data.pollId);

            if (poll.event) {
                throw new AppError("Занятие для этого опроса уже существует", 409);
            }

            if (data.teacherId && data.teacherId !== poll.teacherId) {
                throw new AppError("Преподаватель занятия должен совпадать с преподавателем опроса", 400);
            }

            teacherId = poll.teacherId;
        } else {
            teacherId = await this.resolveTeacherIdForWrite(currentUser, data.teacherId);
        }

        const startAt = new Date(data.startAt);
        const endAt = new Date(data.endAt);
        const isOfficial = data.isOfficial ?? true;

        if (isOfficial && startAt < this.startOfToday()) {
            throw new AppError("Официальное занятие нельзя создать в прошлом", 400);
        }

        if (data.groupId) {
            await this.assertCanUseGroup(currentUser, teacherId, data.groupId);
        }

        await this.assertNoOfficialConflicts(teacherId, data.groupId ?? null, startAt, endAt);

        const event = await prisma.events.create({
            data: {
                pollId: data.pollId ?? null,
                teacherId,
                groupId: data.groupId ?? null,
                title: data.title,
                description: data.description ?? null,
                discipline: data.discipline ?? null,
                lessonType: data.lessonType,
                startAt,
                endAt,
                format: data.format,
                location: data.location ?? null,
                link: data.link ?? null,
                isOfficial,
                status: events_status.scheduled,
            },
        });

        if (!data.pollId && data.groupId) {
            const students = await prisma.users.findMany({
                where: { groupId: data.groupId, role: users_role.student },
                select: { id: true },
            });

            await this.notificationHelper.createUserNotifications(
                students.map((student) => student.id),
                "EVENT_CREATED_WITHOUT_POLL",
                {
                    eventId: event.id,
                    title: event.title,
                    startAt: event.startAt.toISOString(),
                    message: "Преподаватель создал занятие без опроса.",
                },
                { category: "event" }
            );
        }

        return this.getById(currentUser, { id: event.id });
    }

    async createFromPoll(currentUser: AuthUser, data: CreateEventFromPollDto) {
        const poll = await this.getWritablePoll(currentUser, data.pollId);

        if (poll.event) {
            throw new AppError("Занятие для этого опроса уже существует", 409);
        }

        if (poll.status !== polls_status.closed) {
            throw new AppError("Занятие по опросу можно создать только после закрытия опроса", 400);
        }

        const option = poll.options.find((item) => item.id === data.optionId);

        if (!option) {
            throw new AppError("Выбранный вариант не найден в этом опросе", 404);
        }

        if (option.startAt < this.startOfToday()) {
            throw new AppError("Официальное занятие нельзя создать в прошлом", 400);
        }

        const target = await prisma.poll_target_groups.findFirst({
            where: { pollId: poll.id },
            select: { groupId: true },
        });

        await this.assertNoOfficialConflicts(poll.teacherId, target?.groupId ?? null, option.startAt, option.endAt);

        const event = await prisma.events.create({
            data: {
                pollId: poll.id,
                teacherId: poll.teacherId,
                groupId: target?.groupId ?? null,
                title: data.title ?? poll.title,
                description: data.description ?? poll.description ?? null,
                discipline: poll.discipline,
                lessonType: poll.lessonType,
                startAt: option.startAt,
                endAt: option.endAt,
                format: option.format,
                location: option.location,
                link: option.link,
                status: events_status.scheduled,
                isOfficial: true,
            },
        });

        const participants = event.pollId
            ? await prisma.poll_participants_snapshot.findMany({
                where: { pollId: event.pollId },
                select: {
                    studentId: true,
                },
            })
            : [];

        await this.notificationHelper.createUserNotifications(
            participants.map((item) => item.studentId),
            "EVENT_CREATED",
            {
                eventId: event.id,
                pollId: event.pollId,
                title: event.title,
                startAt: event.startAt.toISOString(),
                endAt: event.endAt.toISOString(),
            },
            { category: "event" }
        );

        return this.getById(currentUser, { id: event.id });
    }

    async getById(currentUser: AuthUser, params: GetEventDto) {
        const event = await prisma.events.findUnique({
            where: { id: params.id },
            select: {
                id: true,
                pollId: true,
                teacherId: true,
                groupId: true,
                title: true,
                description: true,
                discipline: true,
                lessonType: true,
                startAt: true,
                endAt: true,
                format: true,
                location: true,
                link: true,
                isOfficial: true,
                status: true,
                createdAt: true,
                teacher: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                    },
                },
                group: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        teacherId: true,
                    },
                },
                poll: {
                    select: {
                        id: true,
                        title: true,
                        status: true,
                        deadlineAt: true,
                        participants: {
                            select: {
                                studentId: true,
                            },
                        },
                    },
                },
            },
        });

        if (!event) {
            throw new AppError("Занятие не найдено", 404);
        }

        this.assertCanReadEvent(currentUser, event);

        const { poll, ...eventData } = event;

        return {
            ...eventData,
            poll: poll
                ? {
                    id: poll.id,
                    title: poll.title,
                    status: poll.status,
                    deadlineAt: poll.deadlineAt,
                }
                : null,
        };
    }

    async list(currentUser: AuthUser, filter: EventFilterDto) {
        const events = await prisma.events.findMany({
            where: {
                ...this.getEventScopeWhere(currentUser, filter.teacherId),
                ...(filter.pollId ? { pollId: filter.pollId } : {}),
                ...(filter.groupId ? { groupId: filter.groupId } : {}),
                ...(filter.status ? { status: filter.status } : {}),
                ...(filter.format ? { format: filter.format } : {}),
                ...(filter.search
                    ? {
                        OR: [
                            {
                                title: {
                                    contains: filter.search,
                                },
                            },
                            {
                                description: {
                                    contains: filter.search,
                                },
                            },
                            {
                                location: {
                                    contains: filter.search,
                                },
                            },
                        ],
                    }
                    : {}),
            },
            orderBy: {
                startAt: "asc",
            },
            select: {
                id: true,
                pollId: true,
                teacherId: true,
                groupId: true,
                title: true,
                description: true,
                discipline: true,
                lessonType: true,
                startAt: true,
                endAt: true,
                format: true,
                location: true,
                link: true,
                isOfficial: true,
                status: true,
                createdAt: true,
                teacher: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                    },
                },
                group: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        teacherId: true,
                    },
                },
                poll: {
                    select: {
                        id: true,
                        title: true,
                        status: true,
                    },
                },
            },
        });

        return events;
    }

    async update(currentUser: AuthUser, params: GetEventDto, data: UpdateEventDto) {
        const existingEvent = await this.getEventForWrite(currentUser, params.id);

        if (existingEvent.status === events_status.cancelled) {
            throw new AppError("Отменённое занятие нельзя обновить", 400);
        }

        if (existingEvent.status === events_status.completed) {
            throw new AppError("Завершённое занятие нельзя обновить", 400);
        }

        const nextStartAt = data.startAt ? new Date(data.startAt) : existingEvent.startAt;
        const nextEndAt = data.endAt ? new Date(data.endAt) : existingEvent.endAt;

        if (nextEndAt <= nextStartAt) {
            throw new AppError("Дата окончания должна быть позже даты начала", 400);
        }

        const nextGroupId = data.groupId !== undefined ? data.groupId : existingEvent.groupId;

        if (existingEvent.isOfficial && nextStartAt < this.startOfToday()) {
            throw new AppError("Официальное занятие нельзя перенести в прошлое", 400);
        }

        if (nextGroupId) {
            await this.assertCanUseGroup(currentUser, existingEvent.teacherId, nextGroupId);
        }

        await this.assertNoOfficialConflicts(existingEvent.teacherId, nextGroupId ?? null, nextStartAt, nextEndAt, existingEvent.id);

        const event = await prisma.events.update({
            where: { id: params.id },
            data: {
                ...(data.title !== undefined ? { title: data.title } : {}),
                ...(data.description !== undefined ? { description: data.description } : {}),
                ...(data.groupId !== undefined ? { groupId: data.groupId } : {}),
                ...(data.discipline !== undefined ? { discipline: data.discipline } : {}),
                ...(data.lessonType !== undefined ? { lessonType: data.lessonType } : {}),
                ...(data.startAt !== undefined ? { startAt: new Date(data.startAt) } : {}),
                ...(data.endAt !== undefined ? { endAt: new Date(data.endAt) } : {}),
                ...(data.format !== undefined ? { format: data.format } : {}),
                ...(data.location !== undefined ? { location: data.location } : {}),
                ...(data.link !== undefined ? { link: data.link } : {}),
                ...(data.status !== undefined ? { status: data.status } : {}),
            },
        });

        return this.getById(currentUser, { id: event.id });
    }

    async delete(currentUser: AuthUser, params: DeleteEventDto) {
        await this.getEventForWrite(currentUser, params.id);

        await prisma.events.delete({
            where: { id: params.id },
        });

        return { success: true };
    }

    async cancel(currentUser: AuthUser, params: GetEventDto) {
        const existingEvent = await this.getEventForWrite(currentUser, params.id);

        if (existingEvent.status === events_status.completed) {
            throw new AppError("Завершённое занятие нельзя отменить", 400);
        }

        await prisma.events.update({
            where: { id: params.id },
            data: {
                status: events_status.cancelled,
            },
        });

        return this.getById(currentUser, params);
    }

    async complete(currentUser: AuthUser, params: GetEventDto) {
        const existingEvent = await this.getEventForWrite(currentUser, params.id);

        if (existingEvent.status === events_status.cancelled) {
            throw new AppError("Отменённое занятие нельзя завершить", 400);
        }

        await prisma.events.update({
            where: { id: params.id },
            data: {
                status: events_status.completed,
            },
        });

        return this.getById(currentUser, params);
    }

    private async resolveTeacherIdForWrite(currentUser: AuthUser, requestedTeacherId?: number) {
        if (currentUser.role === users_role.teacher) {
            if (requestedTeacherId && requestedTeacherId !== currentUser.id) {
                throw new AppError("Нельзя создать занятие за другого преподавателя", 403);
            }

            return currentUser.id;
        }

        if (currentUser.role !== users_role.admin) {
            throw new AppError("Недостаточно прав", 403);
        }

        if (!requestedTeacherId) {
            throw new AppError("Для создания мероприятия администратором нужно указать преподавателя", 400);
        }

        const teacher = await prisma.users.findFirst({
            where: {
                id: requestedTeacherId,
                role: users_role.teacher,
            },
            select: {
                id: true,
            },
        });

        if (!teacher) {
            throw new AppError("Преподаватель не найден", 404);
        }

        return requestedTeacherId;
    }

    private startOfToday() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return today;
    }

    private async assertCanUseGroup(currentUser: AuthUser, teacherId: number, groupId: number) {
        const group = await prisma.study_groups.findUnique({
            where: { id: groupId },
            select: { id: true, teacherId: true },
        });

        if (!group) {
            throw new AppError("Группа не найдена", 404);
        }

        if (currentUser.role === users_role.admin) {
            return;
        }

        if (currentUser.role === users_role.teacher && group.teacherId === teacherId) {
            return;
        }

        throw new AppError("Нельзя создать занятие для этой группы", 403);
    }

    private async assertNoOfficialConflicts(
        teacherId: number,
        groupId: number | null,
        startAt: Date,
        endAt: Date,
        excludeEventId?: number
    ) {
        const conflict = await prisma.events.findFirst({
            where: {
                isOfficial: true,
                status: events_status.scheduled,
                ...(excludeEventId ? { NOT: { id: excludeEventId } } : {}),
                startAt: { lt: endAt },
                endAt: { gt: startAt },
                OR: [
                    { teacherId },
                    ...(groupId ? [{ groupId }] : []),
                ],
            },
            select: { id: true },
        });

        if (conflict) {
            throw new AppError("Официальное занятие пересекается с расписанием преподавателя или группы", 409);
        }
    }

    private async getWritablePoll(currentUser: AuthUser, pollId: number) {
        const poll = await prisma.polls.findUnique({
            where: { id: pollId },
            include: {
                event: true,
                options: true,
            },
        });

        if (!poll) {
            throw new AppError("Опрос не найден", 404);
        }

        if (currentUser.role === users_role.admin) {
            return poll;
        }

        if (currentUser.role === users_role.teacher && poll.teacherId === currentUser.id) {
            return poll;
        }

        throw new AppError("Недостаточно прав", 403);
    }

    private getEventScopeWhere(currentUser: AuthUser, requestedTeacherId?: number) {
        if (currentUser.role === users_role.admin) {
            return requestedTeacherId ? { teacherId: requestedTeacherId } : {};
        }

        if (currentUser.role === users_role.teacher) {
            if (requestedTeacherId && requestedTeacherId !== currentUser.id) {
                throw new AppError("Недостаточно прав", 403);
            }

            return { teacherId: currentUser.id };
        }

        return {
            OR: [
                {
                    poll: {
                        is: {
                            participants: {
                                some: {
                                    studentId: currentUser.id,
                                },
                            },
                        },
                    },
                },
                ...(currentUser.groupId ? [{ groupId: currentUser.groupId }] : []),
            ],
        };
    }

    private assertCanReadEvent(
        currentUser: AuthUser,
        event: {
            teacherId: number;
            groupId: number | null;
            poll: { participants: Array<{ studentId: number }> } | null;
        }
    ) {
        if (currentUser.role === users_role.admin) {
            return;
        }

        if (currentUser.role === users_role.teacher && event.teacherId === currentUser.id) {
            return;
        }

        if (
            currentUser.role === users_role.student &&
            (
                event.poll?.participants.some((participant) => participant.studentId === currentUser.id) ||
                (event.groupId !== null && event.groupId === currentUser.groupId)
            )
        ) {
            return;
        }

        throw new AppError("Занятие не найдено", 404);
    }

    private async getEventForWrite(currentUser: AuthUser, eventId: number) {
        const event = await prisma.events.findUnique({
            where: { id: eventId },
        });

        if (!event) {
            throw new AppError("Занятие не найдено", 404);
        }

        if (currentUser.role === users_role.admin) {
            return event;
        }

        if (currentUser.role === users_role.teacher && event.teacherId === currentUser.id) {
            return event;
        }

        throw new AppError("Недостаточно прав", 403);
    }
}
