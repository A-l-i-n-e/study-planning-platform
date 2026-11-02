import { CalendarDashboard } from '@/shared/ui/calendar-dashboard/CalendarDashboard';
import { PageLayout } from '@/widgets/page-layout';

export const TeacherPage = () => {
    return (
        <PageLayout>
            <CalendarDashboard role="teacher" />
        </PageLayout>
    );
};
