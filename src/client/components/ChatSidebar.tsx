import Brand from './Brand.js';
import styles from './ChatSidebar.module.css';

type ChatSidebarProps = {
    phone: string;
    lastMessage: string;
    time: string;
};

export default function ChatSidebar({phone, lastMessage, time}: ChatSidebarProps) {
    return (
        <aside className={styles.sidebar}>
            <Brand className={styles.brand} />

            <button className={styles.newChat} type="button">
                <span aria-hidden="true">＋</span>
                Новый чат
            </button>

            <div className={styles.chatList}>
                <button className={`${styles.chatListItem} ${styles.active}`} type="button">
                    <span className={styles.chatListCopy}>
                        <strong>{phone}</strong>
                        <span>{lastMessage}</span>
                    </span>
                    <time>{time}</time>
                </button>
            </div>
        </aside>
    );
}
