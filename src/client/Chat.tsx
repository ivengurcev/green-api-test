import {useEffect, useRef, useState} from 'react';
import type {GreenApiClient} from './api/types.js';
import {normalizePhone, toPersonalChatId} from './chat/phone.js';
import type {ActiveChat} from './chat/types.js';
import {useChatSession} from './chat/useChatSession.js';
import ChatSidebar from './components/ChatSidebar.js';
import Conversation from './components/Conversation.js';
import NewChatDialog from './components/NewChatDialog.js';
import styles from './Chat.module.css';

type ChatProps = {
    client: GreenApiClient;
    onLogout?(): void;
};

export default function Chat({client, onLogout = () => {}}: ChatProps) {
    const [activeChat, setActiveChat] = useState<ActiveChat | null>(null);
    const [sessionGeneration, setSessionGeneration] = useState(0);
    const [mobileView, setMobileView] = useState<'list' | 'conversation'>('list');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [checkPending, setCheckPending] = useState(false);
    const [checkError, setCheckError] = useState<string | null>(null);
    const latestCheckRef = useRef(0);
    const checkControllerRef = useRef<AbortController | null>(null);
    const newChatButtonRef = useRef<HTMLButtonElement>(null);
    const messageInputRef = useRef<HTMLInputElement>(null);
    const focusAfterDialogRef = useRef<'new-chat' | 'message' | null>(null);
    const session = useChatSession(client, activeChat, sessionGeneration);

    useEffect(() => () => checkControllerRef.current?.abort(), []);

    useEffect(() => {
        if (dialogOpen || focusAfterDialogRef.current === null) {
            return;
        }

        const target = focusAfterDialogRef.current;
        focusAfterDialogRef.current = null;
        queueMicrotask(() => {
            if (target === 'message') {
                messageInputRef.current?.focus();
            } else {
                newChatButtonRef.current?.focus();
            }
        });
    }, [activeChat, dialogOpen]);

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
        focusAfterDialogRef.current = 'new-chat';
        setDialogOpen(false);
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

            setActiveChat({chatId: toPersonalChatId(phone), phone: `+${phone}`});
            setSessionGeneration((current) => current + 1);
            setMobileView('conversation');
            focusAfterDialogRef.current = 'message';
            setDialogOpen(false);
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
            <div className={styles.workspace} inert={dialogOpen ? true : undefined}>
                <ChatSidebar
                    activeChat={activeChat}
                    mobileVisible={mobileView === 'list'}
                    newChatButtonRef={newChatButtonRef}
                    onNewChat={openDialog}
                    onSelectActive={() => setMobileView('conversation')}
                />
                <Conversation
                    activeChat={activeChat}
                    messageInputRef={messageInputRef}
                    mobileVisible={mobileView === 'conversation'}
                    session={session}
                    onBack={() => setMobileView('list')}
                    onLogout={onLogout}
                />
            </div>
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
