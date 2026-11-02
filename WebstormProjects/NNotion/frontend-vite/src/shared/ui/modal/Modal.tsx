import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/shared/ui/button/Button';

interface ModalProps {
    children: ReactNode;
    description?: string;
    footer?: ReactNode;
    onClose: () => void;
    open: boolean;
    title: string;
}

export const Modal = ({ children, description, footer, onClose, open, title }: ModalProps) => {
    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, open]);

    if (!open) {
        return null;
    }

    return (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <button className="modal__backdrop" type="button" onClick={onClose} aria-label="Закрыть" />

            <div className="modal__card">
                <Button
                    aria-label="Закрыть модальное окно"
                    className="modal__close"
                    onClick={onClose}
                    size="sm"
                    variant="ghost"
                >
                    Закрыть
                </Button>

                <div className="modal__header">
                    <h2 className="modal__title" id="modal-title">
                        {title}
                    </h2>
                    {description ? <p className="modal__description">{description}</p> : null}
                </div>

                {children}

                {footer ? <div className="modal__footer">{footer}</div> : null}
            </div>
        </div>
    );
};
