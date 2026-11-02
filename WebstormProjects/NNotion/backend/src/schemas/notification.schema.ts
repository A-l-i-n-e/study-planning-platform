import { z } from "zod";
import {
    notifications_channel,
    notifications_status,
} from "../../generated/prisma/enums";

export const CreateNotificationSchema = z.object({
    userId: z.coerce.number().positive(),
    channel: z.enum([
        notifications_channel.EMAIL,
        notifications_channel.TELEGRAM,
        notifications_channel.IN_APP,
        notifications_channel.CALENDAR,
    ]),
    type: z.string().min(2).max(100),
    category: z.enum(["system", "poll", "event", "task"]).default("system"),
    payload: z.record(z.string(), z.unknown()).nullable().optional(),
    scheduledFor: z.string().datetime().nullable().optional(),
});

export type CreateNotificationDto = z.infer<typeof CreateNotificationSchema>;

export const UpdateNotificationStatusSchema = z.object({
    status: z.enum([
        notifications_status.PENDING,
        notifications_status.SENT,
        notifications_status.FAILED,
    ]),
});

export type UpdateNotificationStatusDto = z.infer<
    typeof UpdateNotificationStatusSchema
>;

export const GetNotificationSchema = z.object({
    id: z.coerce.number().positive(),
});

export type GetNotificationDto = z.infer<typeof GetNotificationSchema>;

export const NotificationFilterSchema = z.object({
    userId: z.coerce.number().positive().optional(),
    channel: z
        .enum([
            notifications_channel.EMAIL,
            notifications_channel.TELEGRAM,
            notifications_channel.IN_APP,
            notifications_channel.CALENDAR,
        ])
        .optional(),
    status: z
        .enum([
            notifications_status.PENDING,
            notifications_status.SENT,
            notifications_status.FAILED,
        ])
        .optional(),
    type: z.string().optional(),
    category: z.enum(["system", "poll", "event", "task"]).optional(),
    readState: z.enum(["new", "read"]).optional(),
});

export type NotificationFilterDto = z.infer<typeof NotificationFilterSchema>;

export const UpdateNotificationSettingsSchema = z.object({
    emailEnabled: z.boolean().optional(),
    telegramEnabled: z.boolean().optional(),
    telegramChatId: z.string().max(255).nullable().optional(),
    inAppEnabled: z.boolean().optional(),
    calendarEnabled: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, {
    message: "Не переданы данные для обновления",
});

export type UpdateNotificationSettingsDto = z.infer<
    typeof UpdateNotificationSettingsSchema
>;

export const MarkNotificationReadSchema = z.object({
    read: z.boolean().default(true),
});

export type MarkNotificationReadDto = z.infer<typeof MarkNotificationReadSchema>;
