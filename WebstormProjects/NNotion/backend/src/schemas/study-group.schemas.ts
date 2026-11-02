import { z } from "zod";

export const CreateStudyGroupSchema = z.object({
    name: z.string().min(2).max(50),
    description: z.string().min(2).max(255),
    teacherId: z.coerce.number().positive().nullable().optional(),
});

export type CreateStudyGroupDto = z.infer<typeof CreateStudyGroupSchema>;

export const UpdateStudyGroupSchema = z
    .object({
        name: z.string().min(2).max(50).optional(),
        description: z.string().min(2).max(255).optional(),
        teacherId: z.coerce.number().positive().nullable().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: "Не переданы данные для обновления",
    });

export type UpdateStudyGroupDto = z.infer<typeof UpdateStudyGroupSchema>;

export const GetStudyGroupSchema = z.object({
    id: z.coerce.number().positive(),
});

export type GetStudyGroupDto = z.infer<typeof GetStudyGroupSchema>;

export const DeleteStudyGroupSchema = z.object({
    id: z.coerce.number().positive(),
});

export type DeleteStudyGroupDto = z.infer<typeof DeleteStudyGroupSchema>;

export const StudyGroupFilterSchema = z.object({
    search: z.string().optional(),
});

export type StudyGroupFilterDto = z.infer<typeof StudyGroupFilterSchema>;

export const TeachingGroupsByDisciplineSchema = z.object({
    discipline: z.string().min(2).max(255),
});

export type TeachingGroupsByDisciplineDto = z.infer<typeof TeachingGroupsByDisciplineSchema>;
