import { z } from "zod";
import { polls_status, poll_options_format } from "../../generated/prisma/enums";

export const LessonTypeSchema = z.enum([
    "лекция",
    "семинар",
    "консультация",
    "мастер-класс",
    "кружок",
    "другое",
]);

export const PollOptionSchema = z
    .object({
        startAt: z.string().datetime(),
        endAt: z.string().datetime().optional(),
        durationMinutes: z.coerce.number().refine((value) => [45, 60, 90, 120].includes(value)).optional(),
        format: z.literal(poll_options_format.OFFLINE),
        location: z.string().max(255).nullable().optional(),
        link: z.string().url().max(500).nullable().optional(),
    })
    .refine((data) => data.endAt !== undefined || data.durationMinutes !== undefined, {
        message: "Нужно указать время окончания или длительность занятия",
        path: ["durationMinutes"],
    })
    .refine((data) => !data.endAt || new Date(data.endAt) > new Date(data.startAt), {
        message: "Дата окончания должна быть позже даты начала",
        path: ["endAt"],
    });

export const CreatePollSchema = z.object({
    teacherId: z.coerce.number().positive().optional(),
    title: z.string().min(2).max(255),
    description: z.string().max(2000).nullable().optional(),
    discipline: z.string().min(2).max(255).nullable().optional(),
    lessonType: LessonTypeSchema.default("другое"),
    deadlineAt: z.string().datetime(),
    threshold: z.number().int().min(1).max(100).optional(),
    targetGroupIds: z.array(z.number().int().positive()).min(1),
    participantStudentIds: z.array(z.number().int().positive()).optional(),
    options: z.array(PollOptionSchema).min(1),
});

export type CreatePollDto = z.infer<typeof CreatePollSchema>;

export const UpdatePollSchema = z
    .object({
        title: z.string().min(2).max(255).optional(),
        description: z.string().max(2000).nullable().optional(),
        discipline: z.string().min(2).max(255).nullable().optional(),
        lessonType: LessonTypeSchema.optional(),
        deadlineAt: z.string().datetime().optional(),
        threshold: z.number().int().min(1).max(100).optional(),
        status: z
            .enum([polls_status.draft, polls_status.active, polls_status.closed])
            .optional(),
        options: z.array(PollOptionSchema).min(1).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: "Не переданы данные для обновления",
    });

export type UpdatePollDto = z.infer<typeof UpdatePollSchema>;

export const GetPollSchema = z.object({
    id: z.coerce.number().positive(),
});

export type GetPollDto = z.infer<typeof GetPollSchema>;

export const GetPollRecommendationsSchema = z.object({
    pollId: z.coerce.number().positive(),
});

export type GetPollRecommendationsDto = z.infer<typeof GetPollRecommendationsSchema>;

export const DeletePollSchema = z.object({
    id: z.coerce.number().positive(),
});

export type DeletePollDto = z.infer<typeof DeletePollSchema>;

export const PollFilterSchema = z.object({
    teacherId: z.coerce.number().positive().optional(),
    status: z
        .enum([polls_status.draft, polls_status.active, polls_status.closed])
        .optional(),
    search: z.string().optional(),
});

export type PollFilterDto = z.infer<typeof PollFilterSchema>;

export const ApprovePollResultSchema = z.object({
    optionId: z.coerce.number().positive(),
    title: z.string().min(2).max(255).optional(),
    description: z.string().max(2000).nullable().optional(),
});

export type ApprovePollResultDto = z.infer<typeof ApprovePollResultSchema>;
