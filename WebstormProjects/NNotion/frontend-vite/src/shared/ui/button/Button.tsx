import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import './Button.scss';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    children: ReactNode;
    variant?: ButtonVariant;
    size?: ButtonSize;
    fullWidth?: boolean;
}

export const Button = ({
    children,
    className,
    fullWidth = false,
    size = 'md',
    type = 'button',
    variant = 'primary',
    ...props
}: ButtonProps) => {
    return (
        <button
            type={type}
            className={cn(
                'button',
                `button--${variant}`,
                `button--${size}`,
                fullWidth && 'button--full',
                className,
            )}
            {...props}
        >
            {children}
        </button>
    );
};
