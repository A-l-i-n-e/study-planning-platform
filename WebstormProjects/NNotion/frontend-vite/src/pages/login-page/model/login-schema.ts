import { z } from 'zod';

export const loginSchema = z.object({
    email: z.string().min(1, 'Введите электронную почту').email('Введите корректную электронную почту'),
    password: z
        .string()
        .min(1, 'Введите пароль')
        .min(6, 'Пароль должен содержать минимум 6 символов'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
