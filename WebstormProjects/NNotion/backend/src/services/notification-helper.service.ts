import { prisma } from "../config/prisma";
import { notifications_channel, notifications_status } from "../../generated/prisma/enums";
import { Prisma } from "../../generated/prisma/client";

type NotificationSchedule = "now" | "later" | "scheduled";

export class NotificationHelperService {
    async createInAppNotifications(
        userIds: number[],
        type: string,
        payload?: Record<string, unknown> | null,
        category = "system"
    ) {
        await this.createUserNotifications(userIds, type, payload, {
            category,
            channels: [notifications_channel.IN_APP],
        });
    }

    async createUserNotifications(
        userIds: number[],
        type: string,
        payload?: Record<string, unknown> | null,
        options?: {
            category?: string;
            channels?: notifications_channel[];
            schedule?: NotificationSchedule;
            scheduledFor?: Date;
        }
    ) {
        const uniqueUserIds = [...new Set(userIds)].filter((id) => Number.isInteger(id) && id > 0);

        if (uniqueUserIds.length === 0) {
            return;
        }

        const settings = await prisma.user_notification_settings.findMany({
            where: {
                userId: {
                    in: uniqueUserIds,
                },
            },
            select: {
                userId: true,
                inAppEnabled: true,
                emailEnabled: true,
            },
        });

        const settingsMap = new Map(settings.map((item) => [item.userId, item]));
        const channels = options?.channels ?? [notifications_channel.IN_APP, notifications_channel.EMAIL];
        const schedule = options?.schedule ?? "now";
        const scheduledFor =
            schedule === "later"
                ? new Date(Date.now() + 60 * 60 * 1000)
                : schedule === "scheduled"
                    ? options?.scheduledFor ?? null
                    : null;

        const rows = uniqueUserIds.flatMap((userId) => {
            const userSettings = settingsMap.get(userId);

            return channels
                .filter((channel) => {
                    if (channel === notifications_channel.IN_APP) {
                        return userSettings?.inAppEnabled ?? true;
                    }

                    if (channel === notifications_channel.EMAIL) {
                        return userSettings?.emailEnabled ?? true;
                    }

                    return false;
                })
                .map((channel) => ({
                    userId,
                    channel,
                    type,
                    category: options?.category ?? "system",
                    ...(payload ? { payload: payload as Prisma.InputJsonValue } : {}),
                    status: scheduledFor ? notifications_status.PENDING : notifications_status.SENT,
                    sentAt: scheduledFor ? null : new Date(),
                    scheduledFor,
                }));
        });

        if (rows.length === 0) {
            return;
        }

        await prisma.notifications.createMany({
            data: rows,
        });
    }
}
