import { CalendarDashboard } from '@/shared/ui/calendar-dashboard/CalendarDashboard';
import { PageLayout } from '@/widgets/page-layout';

export const StudentPage = () => {
    return (
        <PageLayout>
            <CalendarDashboard role="student" />
        </PageLayout>
    );
};
