import { forwardRef, useId } from 'react';
import type { TextareaHTMLAttributes } from 'react';
import { cn } from '@/shared/lib/cn';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    error?: string;
    helperText?: string;
    label?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
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

                <textarea
                    ref={ref}
                    id={fieldId}
                    className={cn('field__control', 'field__control--textarea', className)}
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

Textarea.displayName = 'Textarea';
