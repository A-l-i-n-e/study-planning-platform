import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/app/router/route-paths';
import { getDemoUser } from '@/shared/demo/adapter';
import { tokenStorage } from '@/shared/lib/token-storage';
import type { UserRole } from '@/shared/types/user';
import { Button } from '@/shared/ui/button/Button';
import { Card } from '@/shared/ui/card/Card';
import { SectionHeader } from '@/shared/ui/section-header/SectionHeader';
import { PageLayout } from '@/widgets/page-layout';

const roles: Array<{ role: UserRole; label: string; description: string; path: string }> = [
    { role: 'student', label: 'Студент', description: 'Расписание группы, голосование за время занятий и личные задачи.', path: ROUTES.STUDENT },
    { role: 'teacher', label: 'Преподаватель', description: 'Планирование занятий, создание опросов и просмотр результатов.', path: ROUTES.TEACHER },
    { role: 'admin', label: 'Администратор', description: 'Управление пользователями, учебными группами и событиями.', path: ROUTES.ADMIN },
];

export const DemoPage = () => {
    const navigate = useNavigate();
    const selectRole = (role: UserRole, path: string) => {
        // No credentials, JWT or server request are required for a demo session.
        tokenStorage.setUser(getDemoUser(role));
        navigate(path, { replace: true });
    };

    return (
        <PageLayout withNavbar={false}>
            <section className="page-section demo-start">
                <SectionHeader eyebrow="NNotion" title="Демо дипломного проекта" description="Выберите роль для просмотра интерфейса" />
                <div className="demo-start__roles">
                    {roles.map(({ role, label, description, path }) => (
                        <Card className="stack" key={role}>
                            <h2 className="list-card__title">{label}</h2>
                            <p>{description}</p>
                            <Button fullWidth onClick={() => selectRole(role, path)}>{label}</Button>
                        </Card>
                    ))}
                </div>
                <p className="subtle-text">Действия можно попробовать в браузере. После обновления страницы тестовые данные восстанавливаются.</p>
            </section>
        </PageLayout>
    );
};
