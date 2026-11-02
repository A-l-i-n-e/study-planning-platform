import { z } from "zod";

export const AddStudentToGroupSchema = z.object({
    groupId: z.coerce.number().positive(),
    studentId: z.coerce.number().positive(),
});

export type AddStudentToGroupDto = z.infer<typeof AddStudentToGroupSchema>;

export const GetGroupStudentsSchema = z.object({
    groupId: z.coerce.number().positive(),
});

export type GetGroupStudentsDto = z.infer<typeof GetGroupStudentsSchema>;

export const RemoveStudentFromGroupSchema = z.object({
    groupId: z.coerce.number().positive(),
    studentId: z.coerce.number().positive(),
});

export type RemoveStudentFromGroupDto = z.infer<typeof RemoveStudentFromGroupSchema>;

export const ImportStudentsToGroupSchema = z.object({
    groupId: z.coerce.number().positive(),
    students: z.array(z.object({
        email: z.string().email(),
        name: z.string().min(2).max(100),
        password: z.string().min(6).max(50).optional(),
    })).min(1),
});

export type ImportStudentsToGroupDto = z.infer<typeof ImportStudentsToGroupSchema>;
