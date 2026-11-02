import type { ReactNode } from 'react';

interface SectionHeaderProps {
    actions?: ReactNode;
    description: string;
    eyebrow: string;
    title: string;
}

export const SectionHeader = ({ actions, description, eyebrow, title }: SectionHeaderProps) => {
    return (
        <div className="section-header">
            <span className="eyebrow">{eyebrow}</span>
            <h1 className="section-header__title">{title}</h1>
            <p className="section-header__description">{description}</p>
            {actions}
        </div>
    );
};
