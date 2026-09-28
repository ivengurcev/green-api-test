import {useCallback, useEffect, useRef, useState} from 'react';
import type {GreenApiClient} from '../api/types.js';
import type {ActiveChat, ChatMessage} from './types.js';
import {useNotificationPolling} from './useNotificationPolling.js';

export type ChatSession = {
    messages: ChatMessage[];
    draft: string;
    setDraft(value: string): void;
    send(): Promise<void>;
    sending: boolean;
    sendError: string | null;
    receiveError: string | null;
    receiveStopped: boolean;
    appendIncoming(message: ChatMessage): void;
};

export function useChatSession(
    client: GreenApiClient,
    activeChat: ActiveChat | null,
    sessionGeneration = 0,
): ChatSession {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [draft, setDraft] = useState('');
    const [sending, setSending] = useState(false);
    const [sendError, setSendError] = useState<string | null>(null);
    const sendingRef = useRef(false);
    const sendControllerRef = useRef<AbortController | null>(null);
    const activeChatIdRef = useRef<string | null>(activeChat?.chatId ?? null);
    activeChatIdRef.current = activeChat?.chatId ?? null;

    useEffect(() => {
        sendControllerRef.current?.abort();
        sendControllerRef.current = null;
        sendingRef.current = false;
        setMessages([]);
        setDraft('');
        setSending(false);
        setSendError(null);
    }, [activeChat?.chatId, sessionGeneration]);

    useEffect(() => () => sendControllerRef.current?.abort(), []);

    const appendIncoming = useCallback((message: ChatMessage) => {
        setMessages((current) => [...current, message]);
    }, []);
    const polling = useNotificationPolling({
        client,
        chatId: activeChat?.chatId ?? null,
        sessionGeneration,
        onMessage: appendIncoming,
    });

    async function send() {
        if (sendingRef.current || !activeChat) {
            return;
        }
        if (!draft.trim()) {
            return;
        }
        if (draft.length > 20_000) {
            setSendError('Сообщение не должно быть длиннее 20 000 символов');
            return;
        }

        const message = draft;
        const chatId = activeChat.chatId;
        const controller = new AbortController();
        sendControllerRef.current?.abort();
        sendControllerRef.current = controller;
        sendingRef.current = true;
        setSending(true);
        setSendError(null);

        try {
            const result = await client.sendMessage(chatId, message, controller.signal);

            if (controller.signal.aborted || activeChatIdRef.current !== chatId) {
                return;
            }

            setMessages((current) => [
                ...current,
                {
                    id: result.idMessage,
                    text: message,
                    timestamp: Date.now(),
                    direction: 'outgoing',
                },
            ]);
            setDraft((current) => current === message ? '' : current);
        } catch {
            if (!controller.signal.aborted && activeChatIdRef.current === chatId) {
                setSendError('Не удалось отправить сообщение');
            }
        } finally {
            if (sendControllerRef.current === controller) {
                sendControllerRef.current = null;
                sendingRef.current = false;
                setSending(false);
            }
        }
    }

    return {
        messages,
        draft,
        setDraft,
        send,
        sending,
        sendError,
        receiveError: polling.receiveError,
        receiveStopped: polling.stopped,
        appendIncoming,
    };
}
