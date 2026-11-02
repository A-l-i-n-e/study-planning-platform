import { Link } from 'react-router-dom';
import { Card } from '@/shared/ui/card/Card';

interface EmptyStateProps {
    actionLabel?: string;
    actionTo?: string;
    description: string;
    title: string;
}

export const EmptyState = ({ actionLabel, actionTo, description, title }: EmptyStateProps) => {
    return (
        <Card className="empty-state">
            <h2 className="empty-state__title">{title}</h2>
            <p>{description}</p>
            {actionLabel && actionTo ? (
                <Link className="button button--primary button--md" to={actionTo}>
                    {actionLabel}
                </Link>
            ) : null}
        </Card>
    );
};
