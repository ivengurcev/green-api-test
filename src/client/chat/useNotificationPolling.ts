import {useEffect, useRef, useState} from 'react';
import {GreenApiError} from '../api/GreenApiError.js';
import type {GreenApiClient} from '../api/types.js';
import {parseIncomingText} from './parseNotification.js';
import type {ChatMessage} from './types.js';

const RETRY_DELAYS = [1_000, 2_000, 5_000, 10_000] as const;

type NotificationPollingOptions = {
    client: GreenApiClient;
    chatId: string | null;
    sessionGeneration?: number;
    onMessage(message: ChatMessage): void;
};

export type NotificationPollingState = {
    receiveError: string | null;
    stopped: boolean;
};

function isAbortError(error: unknown): boolean {
    return error instanceof DOMException && error.name === 'AbortError';
}

function retryDelay(attempt: number): number {
    return RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)] ?? 10_000;
}

function sleep(delay: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        const timeout = window.setTimeout(finish, delay);
        signal.addEventListener('abort', abort, {once: true});

        function finish() {
            signal.removeEventListener('abort', abort);
            resolve();
        }

        function abort() {
            window.clearTimeout(timeout);
            reject(new DOMException('Aborted', 'AbortError'));
        }
    });
}

function isAuthenticationError(error: unknown): boolean {
    return error instanceof GreenApiError && error.kind === 'auth';
}

export function useNotificationPolling({
    client,
    chatId,
    sessionGeneration = 0,
    onMessage,
}: NotificationPollingOptions): NotificationPollingState {
    const [receiveError, setReceiveError] = useState<string | null>(null);
    const [stopped, setStopped] = useState(false);
    const onMessageRef = useRef(onMessage);
    onMessageRef.current = onMessage;

    useEffect(() => {
        setReceiveError(null);
        setStopped(false);

        if (!chatId) {
            return;
        }

        const activeChatId = chatId;
        const controller = new AbortController();
        const seenIds = new Set<string>();

        async function deleteWithRetry(receiptId: number) {
            let attempt = 0;

            while (!controller.signal.aborted) {
                try {
                    await client.deleteNotification(receiptId, controller.signal);
                    return;
                } catch (error) {
                    if (isAbortError(error) || controller.signal.aborted) {
                        throw error;
                    }
                    if (isAuthenticationError(error)) {
                        throw error;
                    }

                    setReceiveError(
                        'Не удалось подтвердить получение сообщения. Повторяем попытку…',
                    );
                    await sleep(retryDelay(attempt), controller.signal);
                    attempt += 1;
                }
            }
        }

        async function run() {
            let receiveAttempt = 0;

            while (!controller.signal.aborted) {
                try {
                    const envelope = await client.receiveNotification(controller.signal);

                    if (controller.signal.aborted) {
                        return;
                    }

                    receiveAttempt = 0;
                    setReceiveError(null);

                    if (envelope === null) {
                        continue;
                    }

                    const message = parseIncomingText(envelope, activeChatId);
                    if (message && !seenIds.has(message.id)) {
                        seenIds.add(message.id);
                        onMessageRef.current(message);
                    }

                    await deleteWithRetry(envelope.receiptId);
                    if (!controller.signal.aborted) {
                        setReceiveError(null);
                    }
                } catch (error) {
                    if (isAbortError(error) || controller.signal.aborted) {
                        return;
                    }
                    if (isAuthenticationError(error)) {
                        setReceiveError('Авторизация GREEN-API недействительна.');
                        setStopped(true);
                        return;
                    }

                    setReceiveError('Не удалось получить сообщения. Повторяем попытку…');

                    try {
                        await sleep(retryDelay(receiveAttempt), controller.signal);
                    } catch (delayError) {
                        if (isAbortError(delayError) || controller.signal.aborted) {
                            return;
                        }
                        throw delayError;
                    }
                    receiveAttempt += 1;
                }
            }
        }

        void run();

        return () => controller.abort();
    }, [chatId, client, sessionGeneration]);

    return {receiveError, stopped};
}
