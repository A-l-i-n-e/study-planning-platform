import { forwardRef, useId } from 'react';
import type { SelectHTMLAttributes } from 'react';
import { cn } from '@/shared/lib/cn';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
    error?: string;
    helperText?: string;
    label?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
    ({ children, className, error, helperText, id, label, ...props }, ref) => {
        const generatedId = useId();
        const fieldId = id ?? generatedId;

        return (
            <div className="field">
                {label ? (
                    <label className="field__label" htmlFor={fieldId}>
                        {label}
                    </label>
                ) : null}

                <select
                    ref={ref}
                    id={fieldId}
                    className={cn('field__control', className)}
                    {...props}
                >
                    {children}
                </select>

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

Select.displayName = 'Select';
