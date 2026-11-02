import { z } from "zod";

export const CreatePersonalTaskSchema = z.object({
    title: z.string().min(2).max(255),
    description: z.string().max(2000).nullable().optional(),
    taskDate: z.string().datetime(),
    taskTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
});

export type CreatePersonalTaskDto = z.infer<typeof CreatePersonalTaskSchema>;

export const UpdatePersonalTaskSchema = z
    .object({
        title: z.string().min(2).max(255).optional(),
        description: z.string().max(2000).nullable().optional(),
        taskDate: z.string().datetime().optional(),
        taskTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
        completed: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: "Не переданы данные для обновления",
    });

export type UpdatePersonalTaskDto = z.infer<typeof UpdatePersonalTaskSchema>;

export const GetPersonalTaskSchema = z.object({
    id: z.coerce.number().positive(),
});

export type GetPersonalTaskDto = z.infer<typeof GetPersonalTaskSchema>;

export const PersonalTaskFilterSchema = z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    completed: z.coerce.boolean().optional(),
});

export type PersonalTaskFilterDto = z.infer<typeof PersonalTaskFilterSchema>;
