import type {ActiveChat, ChatMessage} from '../chat/types.js';
import styles from './Conversation.module.css';

type ConversationProps = {
    activeChat: ActiveChat | null;
    messages: ChatMessage[];
};

function formatTime(timestamp: number): string {
    return new Intl.DateTimeFormat('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
    }).format(timestamp);
}

export default function Conversation({activeChat, messages}: ConversationProps) {
    if (!activeChat) {
        return (
            <section className={`${styles.conversation} ${styles.empty}`}>
                <div>
                    <h1>Создайте новый чат</h1>
                    <p>Укажите номер, зарегистрированный в WhatsApp.</p>
                </div>
            </section>
        );
    }

    return (
        <section className={styles.conversation}>
            <header className={styles.header}>
                <strong>{activeChat.phone}</strong>
            </header>

            <div className={styles.messages}>
                {messages.map((message) => (
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

            <form className={styles.messageForm}>
                <input type="text" placeholder="Напишите сообщение..." aria-label="Сообщение" />
                <button className={styles.sendButton} type="button" aria-label="Отправить">
                    <span aria-hidden="true">➤</span>
                </button>
            </form>
        </section>
    );
}
