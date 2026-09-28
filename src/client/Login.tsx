import { useState } from 'react';
import type { SubmitEvent } from 'react';
import Brand from './components/Brand.js';
import type { CredentialActions } from './useCredentials.js';
import styles from './Login.module.css';

export default function Login({credentialsActions}: {credentialsActions: CredentialActions}) {
    const [idInstance, setIdInstance] = useState(
        import.meta.env.DEV ? import.meta.env.VITE_GREEN_API_ID_INSTANCE ?? '' : '',
    );
    const [apiTokenInstance, setApiTokenInstance] = useState(
        import.meta.env.DEV ? import.meta.env.VITE_GREEN_API_TOKEN_INSTANCE ?? '' : '',
    );

    function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        credentialsActions.login({idInstance, apiTokenInstance});
    }

    return (
        <main className={styles.page}>
            <Brand className={styles.pageBrand} />

            <section className={styles.card}>
                <Brand large showName={false} />
                <h1>Вход в чат</h1>
                <p className={styles.description}>
                    Введите данные из личного кабинета<br />
                    GREEN-API для работы с MAX
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

                    <button className={styles.submitButton} type="submit">Войти</button>
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
