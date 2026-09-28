import {useEffect, useRef, useState} from 'react';
import type {SubmitEvent} from 'react';
import styles from './NewChatDialog.module.css';

type NewChatDialogProps = {
    open: boolean;
    pending: boolean;
    error: string | null;
    onClose(): void;
    onSubmit(value: string): Promise<void>;
};

export default function NewChatDialog({
    open,
    pending,
    error,
    onClose,
    onSubmit,
}: NewChatDialogProps) {
    const [phone, setPhone] = useState('');
    const dialogRef = useRef<HTMLElement>(null);

    useEffect(() => {
        if (!open) {
            setPhone('');
        }
    }, [open]);

    useEffect(() => {
        if (!open) {
            return;
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
                return;
            }
            if (event.key !== 'Tab') {
                return;
            }

            const focusable = Array.from(
                dialogRef.current?.querySelectorAll<HTMLElement>(
                    'button:not(:disabled), input:not(:disabled)',
                ) ?? [],
            );
            const first = focusable[0];
            const last = focusable.at(-1);

            if (!first || !last) {
                return;
            }
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose, open]);

    if (!open) {
        return null;
    }

    function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        void onSubmit(phone);
    }

    return (
        <div
            className={styles.backdrop}
            role="presentation"
        >
            <section
                ref={dialogRef}
                className={styles.dialog}
                role="dialog"
                aria-modal="true"
                aria-labelledby="new-chat-title"
            >
                <div className={styles.header}>
                    <h2 id="new-chat-title">Новый чат</h2>
                    <button
                        className={styles.close}
                        type="button"
                        aria-label="Закрыть"
                        onClick={onClose}
                    >
                        ×
                    </button>
                </div>

                <form className={styles.form} onSubmit={handleSubmit}>
                    <label htmlFor="new-chat-phone">Номер телефона</label>
                    <input
                        id="new-chat-phone"
                        type="tel"
                        autoFocus
                        autoComplete="tel"
                        placeholder="79991234567"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        disabled={pending}
                    />

                    {error && <p className={styles.error} role="alert">{error}</p>}

                    <p className={styles.visuallyHidden} role="status" aria-live="polite">
                        {pending ? 'Проверяем номер в WhatsApp' : ''}
                    </p>

                    <button className={styles.submit} type="submit" disabled={pending}>
                        {pending ? 'Проверяем…' : 'Создать чат'}
                    </button>
                </form>
            </section>
        </div>
    );
}
