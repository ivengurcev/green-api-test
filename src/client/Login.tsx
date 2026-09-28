import { useState } from 'react';
import type { SubmitEvent } from 'react';
import { GreenApiError } from './api/GreenApiError.js';
import type { InstanceState } from './api/types.js';
import Brand from './components/Brand.js';
import type { ClientFactory } from './Application.js';
import type { CredentialActions } from './useCredentials.js';
import styles from './Login.module.css';

type LoginStatus =
    | {kind: 'idle'}
    | {kind: 'loading'}
    | {kind: 'error'; message: string};

type LoginProps = {
    credentialsActions: CredentialActions;
    clientFactory: ClientFactory;
};

function instanceStateMessage(state: InstanceState): string {
    switch (state) {
        case 'notAuthorized':
            return 'Инстанс не авторизован. Подключите WhatsApp в личном кабинете GREEN-API.';
        case 'blocked':
            return 'Инстанс заблокирован. Проверьте его состояние в GREEN-API.';
        case 'starting':
        case 'sleepMode':
            return 'Инстанс ещё не готов. Подождите и попробуйте снова.';
        case 'yellowCard':
        case 'suspended':
            return 'Работа инстанса временно ограничена. Проверьте личный кабинет GREEN-API.';
        default:
            return `Инстанс недоступен: ${state}`;
    }
}

function toLoginErrorMessage(error: unknown): string {
    if (!(error instanceof GreenApiError)) {
        return 'Не удалось проверить инстанс. Попробуйте снова.';
    }

    switch (error.kind) {
        case 'auth':
            return 'Проверьте idInstance и apiTokenInstance.';
        case 'network':
            return 'Не удалось подключиться к GREEN-API.';
        case 'rate-limit':
            return 'Слишком много запросов. Попробуйте позже.';
        default:
            return 'GREEN-API не смог проверить инстанс. Попробуйте снова.';
    }
}

export default function Login({credentialsActions, clientFactory}: LoginProps) {
    const [idInstance, setIdInstance] = useState(
        import.meta.env.DEV ? import.meta.env.VITE_GREEN_API_ID_INSTANCE ?? '' : '',
    );
    const [apiTokenInstance, setApiTokenInstance] = useState(
        import.meta.env.DEV ? import.meta.env.VITE_GREEN_API_TOKEN_INSTANCE ?? '' : '',
    );
    const [status, setStatus] = useState<LoginStatus>({kind: 'idle'});

    async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault();

        if (status.kind === 'loading') {
            return;
        }

        setStatus({kind: 'loading'});

        try {
            const candidate = {
                idInstance: idInstance.trim(),
                apiTokenInstance,
            };
            const state = await clientFactory(candidate).getState();

            if (state !== 'authorized') {
                setStatus({kind: 'error', message: instanceStateMessage(state)});
                return;
            }

            credentialsActions.login(candidate);
        } catch (error) {
            setStatus({kind: 'error', message: toLoginErrorMessage(error)});
        }
    }

    return (
        <main className={styles.page}>
            <Brand className={styles.pageBrand} />

            <section className={styles.card}>
                <Brand large showName={false} />
                <h1>Вход в чат</h1>
                <p className={styles.description}>
                    Введите данные из личного кабинета<br />
                    GREEN-API для работы с WhatsApp
                </p>

                <form className={styles.form} onSubmit={handleSubmit}>
                    <div className={styles.field}>
                        <label htmlFor="id-instance">idInstance</label>
                        <input
                            id="id-instance"
                            name="idInstance"
                            type="text"
                            placeholder="Введите idInstance"
                            autoComplete="off"
                            required
                            value={idInstance}
                            onChange={(event) => setIdInstance(event.target.value)}
                        />
                    </div>

                    <div className={styles.field}>
                        <label htmlFor="api-token">apiTokenInstance</label>
                        <input
                            id="api-token"
                            name="apiTokenInstance"
                            type="password"
                            placeholder="Введите apiTokenInstance"
                            autoComplete="off"
                            required
                            value={apiTokenInstance}
                            onChange={(event) => setApiTokenInstance(event.target.value)}
                        />
                    </div>

                    {status.kind === 'error' && (
                        <p className={styles.error} role="alert" aria-live="polite">
                            {status.message}
                        </p>
                    )}

                    <button
                        className={styles.submitButton}
                        type="submit"
                        disabled={status.kind === 'loading'}
                    >
                        {status.kind === 'loading' ? 'Проверяем…' : 'Войти'}
                    </button>
                </form>

                <p className={styles.note}>
                    <span className={styles.noteIcon} aria-hidden="true">🔒</span>
                    <span>
                        Данные хранятся только в памяти браузера
                        и будут сброшены при перезагрузке страницы.
                    </span>
                </p>
            </section>
        </main>
    );
}
