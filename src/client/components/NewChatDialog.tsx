import {useEffect, useState} from 'react';
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

    useEffect(() => {
        if (!open) {
            setPhone('');
        }
    }, [open]);

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
            onKeyDown={(event) => {
                if (event.key === 'Escape') {
                    onClose();
                }
            }}
        >
            <section
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

                    <button className={styles.submit} type="submit" disabled={pending}>
                        {pending ? 'Проверяем…' : 'Создать чат'}
                    </button>
                </form>
            </section>
        </div>
    );
}
