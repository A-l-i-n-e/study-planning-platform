import { Link } from 'react-router-dom';
import { cn } from '@/shared/lib/cn';

type HeaderAction = {
    label: string;
    to: string;
    variant?: 'ghost' | 'primary' | 'secondary';
};

type AppHeaderProps = {
    actions?: HeaderAction[];
    subtitle: string;
    title?: string;
    role: string;
};

export const AppHeader = ({ actions = [], role, subtitle, title = 'NNotion' }: AppHeaderProps) => {
    return (
        <div className="ui-card">
            <div className="split-grid" style={{ alignItems: 'center' }}>
                <div className="stack">
                    <span className="eyebrow">Workspace</span>
                    <h2 className="section-header__title" style={{ fontSize: 'clamp(28px, 4vw, 48px)' }}>
                        {title}
                    </h2>
                    <p>{subtitle}</p>
                </div>

                <div className="stack" style={{ alignItems: 'flex-start' }}>
                    <span className="status-chip status-chip--active">{role}</span>
                    <div className="pill-group">
                        {actions.map((action) => (
                            <Link
                                key={`${action.to}-${action.label}`}
                                to={action.to}
                                className={cn('button', `button--${action.variant ?? 'secondary'}`, 'button--sm')}
                            >
                                {action.label}
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
