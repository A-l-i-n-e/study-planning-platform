import { prisma } from "../config/prisma";
import {
    CreateNotificationDto,
    GetNotificationDto,
    NotificationFilterDto,
    UpdateNotificationSettingsDto,
    UpdateNotificationStatusDto,
} from "../schemas/notification.schema";
import { AppError } from "../errors/app-error";
import {
    notifications_channel,
    notifications_status,
    users_role,
} from "../../generated/prisma/enums";
import { Prisma } from "../../generated/prisma/client";

export class NotificationService {
    async create(data: CreateNotificationDto) {
        const user = await prisma.users.findUnique({
            where: { id: data.userId },
            select: {
                id: true,
            },
        });

        if (!user) {
            throw new AppError("Пользователь не найден", 404);
        }

        const settings = await prisma.user_notification_settings.findUnique({
            where: { userId: data.userId },
        });

        const isAllowed = this.isChannelEnabled(data.channel, settings);

        if (!isAllowed) {
            throw new AppError("Этот канал уведомлений отключён у пользователя", 400);
        }

        const notification = await prisma.notifications.create({
            data: {
                userId: data.userId,
                channel: data.channel,
                type: data.type,
                category: data.category,
                ...(data.payload ? { payload: data.payload as Prisma.InputJsonValue } : {}),
                ...(data.scheduledFor ? { scheduledFor: new Date(data.scheduledFor) } : {}),
                status: notifications_status.PENDING,
            },
            select: {
                id: true,
                userId: true,
                channel: true,
                type: true,
                category: true,
                payload: true,
                status: true,
                createdAt: true,
                sentAt: true,
                readAt: true,
                scheduledFor: true,
            },
        });

        return notification;
    }

    async getById(params: GetNotificationDto) {
        const notification = await prisma.notifications.findUnique({
            where: { id: params.id },
            select: {
                id: true,
                userId: true,
                channel: true,
                type: true,
                category: true,
                payload: true,
                status: true,
                createdAt: true,
                sentAt: true,
                readAt: true,
                scheduledFor: true,
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        role: true,
                    },
                },
            },
        });

        if (!notification) {
            throw new AppError("Уведомление не найдено", 404);
        }

        return notification;
    }

    async list(filter: NotificationFilterDto) {
        const notifications = await prisma.notifications.findMany({
            where: {
                ...(filter.userId ? { userId: filter.userId } : {}),
                ...(filter.channel ? { channel: filter.channel } : {}),
                ...(filter.status ? { status: filter.status } : {}),
                ...(filter.type
                    ? {
                        type: {
                            contains: filter.type,
                        },
                    }
                    : {}),
                ...(filter.category ? { category: filter.category } : {}),
                ...(filter.readState === "new" ? { readAt: null } : {}),
                ...(filter.readState === "read" ? { readAt: { not: null } } : {}),
            },
            orderBy: {
                createdAt: "desc",
            },
            select: {
                id: true,
                userId: true,
                channel: true,
                type: true,
                category: true,
                payload: true,
                status: true,
                createdAt: true,
                sentAt: true,
                readAt: true,
                scheduledFor: true,
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        role: true,
                    },
                },
            },
        });

        return notifications;
    }

    async listMyNotifications(userId: number) {
        const notifications = await prisma.notifications.findMany({
            where: {
                userId,
            },
            orderBy: {
                createdAt: "desc",
            },
            select: {
                id: true,
                userId: true,
                channel: true,
                type: true,
                category: true,
                payload: true,
                status: true,
                createdAt: true,
                sentAt: true,
                readAt: true,
                scheduledFor: true,
            },
        });

        return notifications;
    }

    async updateStatus(params: GetNotificationDto, data: UpdateNotificationStatusDto) {
        const existingNotification = await prisma.notifications.findUnique({
            where: { id: params.id },
        });

        if (!existingNotification) {
            throw new AppError("Уведомление не найдено", 404);
        }

        const notification = await prisma.notifications.update({
            where: { id: params.id },
            data: {
                status: data.status,
                ...(data.status === notifications_status.SENT ? { sentAt: new Date() } : {}),
            },
            select: {
                id: true,
                userId: true,
                channel: true,
                type: true,
                category: true,
                payload: true,
                status: true,
                createdAt: true,
                sentAt: true,
                readAt: true,
                scheduledFor: true,
            },
        });

        return notification;
    }

    async markRead(params: GetNotificationDto, read: boolean) {
        const existingNotification = await prisma.notifications.findUnique({
            where: { id: params.id },
        });

        if (!existingNotification) {
            throw new AppError("Уведомление не найдено", 404);
        }

        return prisma.notifications.update({
            where: { id: params.id },
            data: {
                readAt: read ? new Date() : null,
            },
            select: {
                id: true,
                userId: true,
                channel: true,
                type: true,
                category: true,
                payload: true,
                status: true,
                createdAt: true,
                sentAt: true,
                readAt: true,
                scheduledFor: true,
            },
        });
    }

    async delete(params: GetNotificationDto) {
        const existingNotification = await prisma.notifications.findUnique({
            where: { id: params.id },
        });

        if (!existingNotification) {
            throw new AppError("Уведомление не найдено", 404);
        }

        await prisma.notifications.delete({
            where: { id: params.id },
        });

        return { success: true };
    }

    async getMySettings(userId: number) {
        const user = await prisma.users.findUnique({
            where: { id: userId },
            select: { id: true },
        });

        if (!user) {
            throw new AppError("Пользователь не найден", 404);
        }

        let settings = await prisma.user_notification_settings.findUnique({
            where: { userId },
        });

        if (!settings) {
            settings = await prisma.user_notification_settings.create({
                data: {
                    userId,
                    emailEnabled: true,
                    telegramEnabled: false,
                    telegramChatId: null,
                    inAppEnabled: true,
                    calendarEnabled: false,
                },
            });
        }

        return settings;
    }

    async updateMySettings(userId: number, data: UpdateNotificationSettingsDto) {
        const user = await prisma.users.findUnique({
            where: { id: userId },
            select: { id: true },
        });

        if (!user) {
            throw new AppError("Пользователь не найден", 404);
        }

        const existingSettings = await prisma.user_notification_settings.findUnique({
            where: { userId },
        });

        const settings = existingSettings
            ? await prisma.user_notification_settings.update({
                where: { userId },
                data: {
                    ...(data.emailEnabled !== undefined
                        ? { emailEnabled: data.emailEnabled }
                        : {}),
                    ...(data.telegramEnabled !== undefined
                        ? { telegramEnabled: data.telegramEnabled }
                        : {}),
                    ...(data.telegramChatId !== undefined
                        ? { telegramChatId: data.telegramChatId }
                        : {}),
                    ...(data.inAppEnabled !== undefined
                        ? { inAppEnabled: data.inAppEnabled }
                        : {}),
                    ...(data.calendarEnabled !== undefined
                        ? { calendarEnabled: data.calendarEnabled }
                        : {}),
                },
            })
            : await prisma.user_notification_settings.create({
                data: {
                    userId,
                    emailEnabled: data.emailEnabled ?? true,
                    telegramEnabled: data.telegramEnabled ?? false,
                    telegramChatId: data.telegramChatId ?? null,
                    inAppEnabled: data.inAppEnabled ?? true,
                    calendarEnabled: data.calendarEnabled ?? false,
                },
            });

        return settings;
    }

    async checkAccessToNotification(currentUserId: number, notificationId: number) {
        const notification = await prisma.notifications.findUnique({
            where: { id: notificationId },
            select: {
                id: true,
                userId: true,
            },
        });

        if (!notification) {
            throw new AppError("Уведомление не найдено", 404);
        }

        const currentUser = await prisma.users.findUnique({
            where: { id: currentUserId },
            select: {
                id: true,
                role: true,
            },
        });

        if (!currentUser) {
            throw new AppError("Пользователь не найден", 404);
        }

        const isOwner = notification.userId === currentUserId;
        const isAdmin = currentUser.role === users_role.admin;

        if (!isOwner && !isAdmin) {
            throw new AppError("Недостаточно прав", 403);
        }
    }

    private isChannelEnabled(
        channel: notifications_channel,
        settings: {
            emailEnabled: boolean | null;
            telegramEnabled: boolean | null;
            inAppEnabled: boolean | null;
            calendarEnabled: boolean | null;
        } | null
    ) {
        if (!settings) {
            if (channel === notifications_channel.EMAIL) return true;
            if (channel === notifications_channel.IN_APP) return true;
            if (channel === notifications_channel.TELEGRAM) return false;
            if (channel === notifications_channel.CALENDAR) return false;
        }

        switch (channel) {
            case notifications_channel.EMAIL:
                return Boolean(settings?.emailEnabled);
            case notifications_channel.TELEGRAM:
                return Boolean(settings?.telegramEnabled);
            case notifications_channel.IN_APP:
                return Boolean(settings?.inAppEnabled);
            case notifications_channel.CALENDAR:
                return Boolean(settings?.calendarEnabled);
            default:
                return false;
        }
    }
}
