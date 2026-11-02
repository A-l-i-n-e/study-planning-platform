import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
    children: ReactNode;
    hoverable?: boolean;
}

export const Card = ({ children, className, hoverable = false, ...props }: CardProps) => {
    return (
        <div className={cn('ui-card', hoverable && 'ui-card--hover', className)} {...props}>
            {children}
        </div>
    );
};
