import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { tokenStorage } from '@/shared/lib/token-storage';
import type { AuthUser } from '@/shared/types/auth';
import { ROUTES } from './route-paths';
import { IS_DEMO } from '@/shared/demo/config';

const DemoPage = lazy(() => import('../../pages/demo-page/ui/DemoPage').then((module) => ({ default: module.DemoPage })));

import { LoginPage } from '../../pages/login-page';
import { RegisterPage } from '../../pages/register-page';
import { PollsPage } from '../../pages/polls-page';
import { PollDetailsPage } from '../../pages/poll-details-page';
import { EventsPage } from '../../pages/events-page';
import { NotificationsPage } from '../../pages/notifications-page';
import { ProfilePage } from '../../pages/profile-page';

import { AdminPage } from '../../pages/admin-page';
import { TeacherPage } from '../../pages/teacher-page';
import { StudentPage } from '../../pages/student-page';

const roleHome: Record<AuthUser['role'], string> = {
    student: ROUTES.STUDENT,
    teacher: ROUTES.TEACHER,
    admin: ROUTES.ADMIN,
};

const getCurrentUser = () => {
    const token = tokenStorage.getAccessToken();
    const user = tokenStorage.getUser();

    if (!user || (!IS_DEMO && !token)) {
        return null;
    }

    return user;
};

const RoleGate = ({ children, roles }: { children: ReactNode; roles: AuthUser['role'][] }) => {
    const user = getCurrentUser();

    if (!user) {
        return <Navigate to={ROUTES.LOGIN} replace />;
    }

    if (!roles.includes(user.role)) {
        return <Navigate to={roleHome[user.role]} replace />;
    }

    return children;
};

const PublicOnly = ({ children }: { children: ReactNode }) => {
    const user = getCurrentUser();

    if (user) {
        return <Navigate to={roleHome[user.role]} replace />;
    }

    return children;
};

const RootRedirect = () => {
    const user = getCurrentUser();

    return <Navigate to={user ? roleHome[user.role] : ROUTES.LOGIN} replace />;
};

export function AppRouter() {
    return (
        <Routes>
            <Route path={ROUTES.ROOT} element={<RootRedirect />} />
            <Route path={ROUTES.LOGIN} element={IS_DEMO ? <Suspense fallback={<p>Загрузка демо...</p>}><DemoPage /></Suspense> : <LoginPage />} />
            <Route path={ROUTES.REGISTER} element={IS_DEMO ? <Navigate to={ROUTES.LOGIN} replace /> : <PublicOnly><RegisterPage /></PublicOnly>} />
            <Route path={ROUTES.POLLS} element={<RoleGate roles={['student', 'teacher', 'admin']}><PollsPage /></RoleGate>} />
            <Route path={ROUTES.POLL_DETAILS} element={<RoleGate roles={['student', 'teacher', 'admin']}><PollDetailsPage /></RoleGate>} />
            <Route path={ROUTES.EVENTS} element={<RoleGate roles={['student', 'teacher', 'admin']}><EventsPage /></RoleGate>} />
            <Route path={ROUTES.NOTIFICATIONS} element={<RoleGate roles={['student', 'teacher']}><NotificationsPage /></RoleGate>} />
            <Route path={ROUTES.PROFILE} element={<RoleGate roles={['student', 'teacher', 'admin']}><ProfilePage /></RoleGate>} />
            <Route path={ROUTES.ADMIN} element={<RoleGate roles={['admin']}><AdminPage /></RoleGate>} />
            <Route path={ROUTES.TEACHER} element={<RoleGate roles={['teacher']}><TeacherPage /></RoleGate>} />
            <Route path={ROUTES.STUDENT} element={<RoleGate roles={['student']}><StudentPage /></RoleGate>} />
            <Route path="*" element={<RootRedirect />} />
        </Routes>
    );
}
