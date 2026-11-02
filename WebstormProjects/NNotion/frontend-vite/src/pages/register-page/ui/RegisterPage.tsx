import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { ROUTES } from '@/app/router/route-paths';
import { authApi } from '@/shared/api/auth.api';
import { tokenStorage } from '@/shared/lib/token-storage';
import type { AuthUser } from '@/shared/types/auth';
import { Button } from '@/shared/ui/button/Button';
import { Input } from '@/shared/ui/input/Input';
import { PageLayout } from '@/widgets/page-layout';
import { registerSchema, type RegisterFormValues } from '../model/register-schema';
import './RegisterPage.scss';

const roleHome: Record<AuthUser['role'], string> = {
    student: ROUTES.STUDENT,
    teacher: ROUTES.TEACHER,
    admin: ROUTES.ADMIN,
};

export const RegisterPage = () => {
    const navigate = useNavigate();
    const [serverError, setServerError] = useState('');

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<RegisterFormValues>({
        resolver: zodResolver(registerSchema),
        defaultValues: {
            name: '',
            email: '',
            role: 'student',
            password: '',
            confirmPassword: '',
        },
    });

    const onSubmit = async (data: RegisterFormValues) => {
        try {
            setServerError('');

            const response = await authApi.register({
                name: data.name,
                email: data.email,
                password: data.password,
                role: data.role,
            });

            tokenStorage.setAccessToken(response.accessToken);
            tokenStorage.setUser(response.user);

            navigate(roleHome[response.user.role]);
        } catch (error) {
            setServerError('Не удалось зарегистрироваться. Возможно, такая электронная почта уже используется.');
            console.error(error);
        }
    };

    return (
        <PageLayout withNavbar={false}>
            <section className="hero-grid auth-stage">
                <div className="auth-copy">
                    <div className="hero-kicker">
                        <span>Создание профиля</span>
                        <span>Доступ студента</span>
                        <span>Кабинет преподавателя</span>
                    </div>

                    <div className="auth-shell">
                        <h1 className="page-title">Регистрация</h1>
                        <p className="section-description">
                            Создайте аккаунт для совместного планирования консультаций, практик и
                            дополнительных учебных встреч.
                        </p>
                    </div>

                    <div className="editorial-word-stack">
                        {['Войти', 'Расписание', 'Учёба'].map((word, index) => (
                            <div className="editorial-word" key={word}>
                                <div className="editorial-word__label">{word}</div>
                                <p className="editorial-word__meta">
                                    {index === 0 && 'Подключайтесь к общему пространству'}
                                    {index === 1 && 'Собирайте удобные слоты вместе'}
                                    {index === 2 && 'Следите за учебным ритмом команды'}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="ui-card auth-card auth-stage__panel">
                    <span className="eyebrow">Новая учётная запись</span>
                    <h2 className="auth-card__title">Создать профиль</h2>
                    <p className="auth-card__subtitle">
                        Заполните короткую форму и сразу переходите к расписанию и опросам.
                    </p>

                    <form className="auth-form" onSubmit={handleSubmit(onSubmit)}>
                        <Input
                            label="Имя"
                            type="text"
                            placeholder="Алина Иванова"
                            error={errors.name?.message}
                            {...register('name')}
                        />

                        <Input
                            label="Электронная почта"
                            type="email"
                            placeholder="student@university.ru"
                            error={errors.email?.message}
                            {...register('email')}
                        />

                        <input type="hidden" value="student" {...register('role')} />

                        <Input
                            label="Пароль"
                            type="password"
                            placeholder="Минимум 6 символов"
                            error={errors.password?.message}
                            {...register('password')}
                        />

                        <Input
                            label="Подтверждение пароля"
                            type="password"
                            placeholder="Повторите пароль"
                            error={errors.confirmPassword?.message}
                            {...register('confirmPassword')}
                        />

                        {serverError ? <div className="alert">{serverError}</div> : null}

                        <Button type="submit" fullWidth size="lg" disabled={isSubmitting}>
                            {isSubmitting ? 'Регистрация...' : 'Создать аккаунт'}
                        </Button>
                    </form>

                    <p className="auth-footer">
                        Уже есть аккаунт? <Link to={ROUTES.LOGIN}>Войти</Link>
                    </p>
                </div>
            </section>
        </PageLayout>
    );
};
