import { Card } from '@/shared/ui/card/Card';
import type { KeyboardEvent } from 'react';

interface StatCardProps {
    eyebrow?: string;
    hint?: string;
    label: string;
    onClick?: () => void;
    value: string;
}

export const StatCard = ({ eyebrow = 'Insight', hint, label, onClick, value }: StatCardProps) => {
    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (!onClick || (event.key !== 'Enter' && event.key !== ' ')) {
            return;
        }

        event.preventDefault();
        onClick();
    };

    return (
        <Card
            className={`stat-card ${onClick ? 'stat-card--clickable' : ''}`}
            hoverable
            onClick={onClick}
            onKeyDown={handleKeyDown}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
        >
            <span className="stat-card__eyebrow">{eyebrow}</span>
            <strong className="stat-card__value">{value}</strong>
            <div>
                <p className="stat-card__label">{label}</p>
                {hint ? <p className="stat-card__hint">{hint}</p> : null}
            </div>
        </Card>
    );
};
