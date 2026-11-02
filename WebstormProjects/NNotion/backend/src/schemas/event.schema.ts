import { z } from "zod";
import { events_format, events_status } from "../../generated/prisma/enums";
import { LessonTypeSchema } from "./poll.schema";

export const CreateEventSchema = z
    .object({
        teacherId: z.coerce.number().positive().optional(),
        pollId: z.number().int().positive().nullable().optional(),
        groupId: z.coerce.number().positive().nullable().optional(),
        title: z.string().min(2).max(255),
        description: z.string().max(2000).nullable().optional(),
        discipline: z.string().min(2).max(255).nullable().optional(),
        lessonType: LessonTypeSchema.default("другое"),
        startAt: z.string().datetime(),
        endAt: z.string().datetime(),
        format: z.enum([events_format.ONLINE, events_format.OFFLINE]),
        location: z.string().max(255).nullable().optional(),
        link: z.string().url().max(500).nullable().optional(),
        isOfficial: z.boolean().optional(),
    })
    .refine((data) => new Date(data.endAt) > new Date(data.startAt), {
        message: "Дата окончания должна быть позже даты начала",
        path: ["endAt"],
    });

export type CreateEventDto = z.infer<typeof CreateEventSchema>;

export const CreateEventFromPollSchema = z.object({
    pollId: z.coerce.number().positive(),
    optionId: z.coerce.number().positive(),
    title: z.string().min(2).max(255).optional(),
    description: z.string().max(2000).nullable().optional(),
});

export type CreateEventFromPollDto = z.infer<typeof CreateEventFromPollSchema>;

export const UpdateEventSchema = z
    .object({
        title: z.string().min(2).max(255).optional(),
        description: z.string().max(2000).nullable().optional(),
        groupId: z.coerce.number().positive().nullable().optional(),
        discipline: z.string().min(2).max(255).nullable().optional(),
        lessonType: LessonTypeSchema.optional(),
        startAt: z.string().datetime().optional(),
        endAt: z.string().datetime().optional(),
        format: z.enum([events_format.ONLINE, events_format.OFFLINE]).optional(),
        location: z.string().max(255).nullable().optional(),
        link: z.string().url().max(500).nullable().optional(),
        status: z
            .enum([
                events_status.scheduled,
                events_status.cancelled,
                events_status.completed,
            ])
            .optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: "Не переданы данные для обновления",
    });

export type UpdateEventDto = z.infer<typeof UpdateEventSchema>;

export const GetEventSchema = z.object({
    id: z.coerce.number().positive(),
});

export type GetEventDto = z.infer<typeof GetEventSchema>;

export const DeleteEventSchema = z.object({
    id: z.coerce.number().positive(),
});

export type DeleteEventDto = z.infer<typeof DeleteEventSchema>;

export const EventFilterSchema = z.object({
    teacherId: z.coerce.number().positive().optional(),
    pollId: z.coerce.number().positive().optional(),
    groupId: z.coerce.number().positive().optional(),
    status: z
        .enum([
            events_status.scheduled,
            events_status.cancelled,
            events_status.completed,
        ])
        .optional(),
    format: z.enum([events_format.ONLINE, events_format.OFFLINE]).optional(),
    search: z.string().optional(),
});

export type EventFilterDto = z.infer<typeof EventFilterSchema>;
