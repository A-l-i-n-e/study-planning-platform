import { z } from 'zod';

export const registerRoleSchema = z.literal('student');

export const registerSchema = z
    .object({
        name: z
            .string()
            .min(1, 'Введите имя')
            .min(2, 'Имя должно содержать минимум 2 символа'),
        email: z.string().min(1, 'Введите электронную почту').email('Введите корректную электронную почту'),
        role: registerRoleSchema,
        password: z
            .string()
            .min(1, 'Введите пароль')
            .min(6, 'Пароль должен содержать минимум 6 символов'),
        confirmPassword: z.string().min(1, 'Подтвердите пароль'),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: 'Пароли не совпадают',
        path: ['confirmPassword'],
    });

export type RegisterFormValues = z.infer<typeof registerSchema>;
