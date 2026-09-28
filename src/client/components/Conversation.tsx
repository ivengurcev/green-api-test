import styles from './Conversation.module.css';

export type Message = {
    id: number;
    text: string;
    time: string;
    direction: 'incoming' | 'outgoing';
};

type ConversationProps = {
    phone: string;
    messages: Message[];
};

export default function Conversation({phone, messages}: ConversationProps) {
    return (
        <section className={styles.conversation}>
            <header className={styles.header}>
                <strong>{phone}</strong>
                <span className={styles.online}>В сети</span>
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
                            <time>{message.time}</time>
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
