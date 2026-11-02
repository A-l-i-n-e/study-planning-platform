import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes } from 'react';
import { cn } from '@/shared/lib/cn';
import './Input.scss';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    error?: string;
    helperText?: string;
    label?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className, error, helperText, id, label, ...props }, ref) => {
        const generatedId = useId();
        const fieldId = id ?? generatedId;

        return (
            <div className="field">
                {label ? (
                    <label className="field__label" htmlFor={fieldId}>
                        {label}
                    </label>
                ) : null}

                <input
                    ref={ref}
                    id={fieldId}
                    className={cn('field__control', className)}
                    {...props}
                />

                {error || helperText ? (
                    <div className="field__meta">
                        <span className={error ? 'field__error' : 'field__helper'}>
                            {error ?? helperText}
                        </span>
                    </div>
                ) : null}
            </div>
        );
    },
);

Input.displayName = 'Input';
