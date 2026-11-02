import { z } from "zod";
import { users_role } from "../../generated/prisma/enums";

// регистрация
export const UserRegistrationSchema = z.object({
    email: z.string().email(),
    name: z.string().min(2).max(100),
    passHash: z.string().min(6).max(50),
    role: z.enum([users_role.student, users_role.teacher, users_role.admin]),
});

export type UserRegistrationSchemaDto = z.infer<typeof UserRegistrationSchema>;

export const AdminCreateUserSchema = UserRegistrationSchema.extend({
    groupId: z.coerce.number().positive().nullable().optional(),
});

export type AdminCreateUserSchemaDto = z.infer<typeof AdminCreateUserSchema>;

// вход в систему
export const loginUserSchema = z.object({
    email: z.string().email().min(1),
    password: z.string().min(6),
});

export type loginUserSchemaDto = z.infer<typeof loginUserSchema>;

export const RoleLoginSchema = z.object({
    role: z.enum([users_role.student, users_role.teacher, users_role.admin]),
});

export type RoleLoginSchemaDto = z.infer<typeof RoleLoginSchema>;

export const UserLoginSchema = z.object({
    userId: z.coerce.number().positive(),
});

export type UserLoginSchemaDto = z.infer<typeof UserLoginSchema>;

// обновление
export const UpdateUserSchema = z
    .object({
        email: z.string().email().optional(),
        name: z.string().min(2).max(100).optional(),
        role: z.enum([users_role.student, users_role.teacher, users_role.admin]).optional(),
        groupId: z.coerce.number().positive().nullable().optional(),
        isActive: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: "Не переданы данные для обновления",
    });

export type UpdateUserSchemaDto = z.infer<typeof UpdateUserSchema>;

// получение пользователя по ID
export const GetUserSchema = z.object({
    id: z.coerce.number().positive(),
});

export type GetUserSchemaDto = z.infer<typeof GetUserSchema>;

// удаление пользователей
export const DeleteUserSchema = z.object({
    id: z.coerce.number().positive(),
});

export type DeleteUserSchemaDto = z.infer<typeof DeleteUserSchema>;

// смена пароля
export const UserChangePasswordSchema = z
    .object({
        oldPassword: z.string().min(6).max(50),
        newPassword: z.string().min(6).max(50),
        confirmPassword: z.string().min(6).max(50),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
        message: "Подтверждение пароля не совпадает",
        path: ["confirmPassword"],
    });

export type UserChangePasswordSchemaDto = z.infer<typeof UserChangePasswordSchema>;

// фильтрация списка пользователей
export const UserFilterSchema = z.object({
    role: z.enum([users_role.student, users_role.teacher, users_role.admin]).optional(),
    search: z.string().optional(),
    groupId: z.coerce.number().positive().optional(),
    isActive: z.coerce.boolean().optional(),
});

export type UserFilterSchemaDto = z.infer<typeof UserFilterSchema>;

// ответ с токеном
export const UserAuthResponseSchema = z.object({
    user: z.object({
        id: z.number(),
        email: z.string().email(),
        name: z.string(),
        role: z.enum([users_role.student, users_role.teacher, users_role.admin]),
        groupId: z.number().nullable().optional(),
        isActive: z.boolean(),
        createdAt: z.date(),
    }),
    token: z.string(),
});

export type UserAuthResponseSchemaDto = z.infer<typeof UserAuthResponseSchema>;
