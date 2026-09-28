import type {RefObject} from 'react';
import type {ActiveChat} from '../chat/types.js';
import Brand from './Brand.js';
import styles from './ChatSidebar.module.css';

type ChatSidebarProps = {
    activeChat: ActiveChat | null;
    mobileVisible: boolean;
    newChatButtonRef: RefObject<HTMLButtonElement | null>;
    onNewChat(): void;
    onSelectActive(): void;
};

export default function ChatSidebar({
    activeChat,
    mobileVisible,
    newChatButtonRef,
    onNewChat,
    onSelectActive,
}: ChatSidebarProps) {
    return (
        <aside className={`${styles.sidebar} ${mobileVisible ? styles.mobileVisible : ''}`}>
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
                    <button
                        className={`${styles.chatListItem} ${styles.active}`}
                        type="button"
                        onClick={onSelectActive}
                    >
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
