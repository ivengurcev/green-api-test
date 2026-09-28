import {useEffect, useRef, useState} from 'react';
import type {GreenApiClient} from './api/types.js';
import {normalizePhone, toPersonalChatId} from './chat/phone.js';
import type {ActiveChat} from './chat/types.js';
import {useChatSession} from './chat/useChatSession.js';
import ChatSidebar from './components/ChatSidebar.js';
import Conversation from './components/Conversation.js';
import NewChatDialog from './components/NewChatDialog.js';
import styles from './Chat.module.css';

export default function Chat({client}: {client: GreenApiClient}) {
    const [activeChat, setActiveChat] = useState<ActiveChat | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [checkPending, setCheckPending] = useState(false);
    const [checkError, setCheckError] = useState<string | null>(null);
    const latestCheckRef = useRef(0);
    const checkControllerRef = useRef<AbortController | null>(null);
    const newChatButtonRef = useRef<HTMLButtonElement>(null);
    const session = useChatSession(client, activeChat);

    useEffect(() => () => checkControllerRef.current?.abort(), []);

    function openDialog() {
        setCheckError(null);
        setDialogOpen(true);
    }

    function closeDialog() {
        latestCheckRef.current += 1;
        checkControllerRef.current?.abort();
        checkControllerRef.current = null;
        setCheckPending(false);
        setCheckError(null);
        setDialogOpen(false);
        queueMicrotask(() => newChatButtonRef.current?.focus());
    }

    async function createChat(value: string) {
        let phone: string;

        try {
            phone = normalizePhone(value);
        } catch (error) {
            setCheckError(error instanceof Error ? error.message : 'Проверьте номер телефона');
            return;
        }

        const requestId = ++latestCheckRef.current;
        checkControllerRef.current?.abort();
        const controller = new AbortController();
        checkControllerRef.current = controller;
        setCheckPending(true);
        setCheckError(null);

        try {
            const checked = await client.checkWhatsapp(toPersonalChatId(phone), controller.signal);

            if (requestId !== latestCheckRef.current) {
                return;
            }
            if (!checked.existsWhatsapp || !checked.chatId) {
                setCheckError('На этом номере не найден аккаунт WhatsApp');
                return;
            }

            setActiveChat({chatId: checked.chatId, phone: `+${phone}`});
            setDialogOpen(false);
            queueMicrotask(() => newChatButtonRef.current?.focus());
        } catch (error) {
            if (requestId === latestCheckRef.current && !controller.signal.aborted) {
                setCheckError('Не удалось проверить номер. Попробуйте снова.');
            }
        } finally {
            if (requestId === latestCheckRef.current) {
                setCheckPending(false);
                checkControllerRef.current = null;
            }
        }
    }

    return (
        <main className={styles.shell}>
            <ChatSidebar
                activeChat={activeChat}
                newChatButtonRef={newChatButtonRef}
                onNewChat={openDialog}
            />
            <Conversation activeChat={activeChat} session={session} />
            <NewChatDialog
                open={dialogOpen}
                pending={checkPending}
                error={checkError}
                onClose={closeDialog}
                onSubmit={createChat}
            />
        </main>
    );
}
