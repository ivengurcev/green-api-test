import type {RefObject} from 'react';
import type {ActiveChat} from '../chat/types.js';
import Brand from './Brand.js';
import styles from './ChatSidebar.module.css';

type ChatSidebarProps = {
    activeChat: ActiveChat | null;
    newChatButtonRef: RefObject<HTMLButtonElement | null>;
    onNewChat(): void;
};

export default function ChatSidebar({activeChat, newChatButtonRef, onNewChat}: ChatSidebarProps) {
    return (
        <aside className={styles.sidebar}>
            <Brand className={styles.brand} />

            <button
                className={styles.newChat}
                type="button"
                ref={newChatButtonRef}
                onClick={onNewChat}
            >
                <span aria-hidden="true">＋</span>
                Новый чат
            </button>

            {activeChat && (
                <div className={styles.chatList}>
                    <button className={`${styles.chatListItem} ${styles.active}`} type="button">
                        <span className={styles.chatListCopy}>
                            <strong>{activeChat.phone}</strong>
                            <span>Чат создан</span>
                        </span>
                    </button>
                </div>
            )}
        </aside>
    );
}
