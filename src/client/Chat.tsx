import ChatSidebar from './components/ChatSidebar.js';
import Conversation from './components/Conversation.js';
import type { Credentials } from './useCredentials.js';
import styles from './Chat.module.css';

const phone = '+7 999 123-45-67';

const messages = [
    {id: 1, text: 'Привет!', time: '12:20', direction: 'incoming' as const},
    {id: 2, text: 'Привет!', time: '12:21 ✓✓', direction: 'outgoing' as const},
    {id: 3, text: 'Это тестовое сообщение из MAX', time: '12:21', direction: 'incoming' as const},
    {id: 4, text: 'Отлично, всё работает', time: '12:22 ✓✓', direction: 'outgoing' as const},
    {id: 5, text: 'Как дела?', time: '12:24', direction: 'incoming' as const},
    {id: 6, text: 'Всё хорошо, спасибо!\nА у тебя?', time: '12:24 ✓✓', direction: 'outgoing' as const},
];

export default function Chat({credentials}: {credentials: Credentials}) {
    void credentials;

    return (
        <main className={styles.shell}>
            <ChatSidebar phone={phone} lastMessage="Как дела?" time="12:24" />
            <Conversation phone={phone} messages={messages} />
        </main>
    );
}
