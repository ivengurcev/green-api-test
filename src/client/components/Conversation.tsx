import type {SubmitEvent} from 'react';
import type {ActiveChat, ChatMessage} from '../chat/types.js';
import type {ChatSession} from '../chat/useChatSession.js';
import styles from './Conversation.module.css';

type ConversationProps = {
    activeChat: ActiveChat | null;
    mobileVisible: boolean;
    session: ChatSession;
    onBack(): void;
};

function formatTime(timestamp: number): string {
    return new Intl.DateTimeFormat('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
    }).format(timestamp);
}

export default function Conversation({
    activeChat,
    mobileVisible,
    session,
    onBack,
}: ConversationProps) {
    const className = `${styles.conversation} ${mobileVisible ? styles.mobileVisible : ''}`;

    if (!activeChat) {
        return (
            <section className={`${className} ${styles.empty}`}>
                <div>
                    <h1>Создайте новый чат</h1>
                    <p>Укажите номер, зарегистрированный в WhatsApp.</p>
                </div>
            </section>
        );
    }

    function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        void session.send();
    }

    return (
        <section className={className}>
            <header className={styles.header}>
                <button
                    className={styles.backButton}
                    type="button"
                    aria-label="Назад к чатам"
                    onClick={onBack}
                >
                    <span aria-hidden="true">←</span>
                </button>
                <strong>{activeChat.phone}</strong>
            </header>

            <div className={styles.messages}>
                {session.receiveError && (
                    <p className={styles.receiveError} role="status">
                        {session.receiveError}
                    </p>
                )}
                {session.messages.map((message: ChatMessage) => (
                    <div
                        className={`${styles.messageRow} ${styles[message.direction]}`}
                        key={message.id}
                    >
                        <div className={styles.message}>
                            {message.text.split('\n').map((line, index) => (
                                <span key={`${message.id}-${index}`}>
                                    {index > 0 && <br />}
                                    {line}
                                </span>
                            ))}
                            <time dateTime={new Date(message.timestamp).toISOString()}>
                                {formatTime(message.timestamp)}
                            </time>
                        </div>
                    </div>
                ))}
            </div>

            <form className={styles.messageForm} onSubmit={handleSubmit}>
                <input
                    type="text"
                    placeholder="Напишите сообщение..."
                    aria-label="Сообщение"
                    maxLength={20_000}
                    value={session.draft}
                    disabled={session.sending}
                    onChange={(event) => session.setDraft(event.target.value)}
                />
                {session.sendError && (
                    <p className={styles.sendError} role="alert">{session.sendError}</p>
                )}
                <button
                    className={styles.sendButton}
                    type="submit"
                    aria-label="Отправить"
                    disabled={session.sending}
                >
                    <span aria-hidden="true">➤</span>
                </button>
            </form>
        </section>
    );
}
