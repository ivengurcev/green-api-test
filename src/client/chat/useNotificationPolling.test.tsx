import {act, renderHook, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {GreenApiError} from '../api/GreenApiError.js';
import type {NotificationEnvelope} from '../api/types.js';
import {createGreenApiClientMock} from '../test/createGreenApiClientMock.js';
import type {ChatMessage} from './types.js';
import {useNotificationPolling} from './useNotificationPolling.js';

const client = createGreenApiClientMock();
const chatId = '79991234567@c.us';
const onMessage = vi.fn<(message: ChatMessage) => void>();

function textNotification(idMessage: string, notificationChatId: string): NotificationEnvelope {
    return {
        receiptId: 42,
        body: {
            typeWebhook: 'incomingMessageReceived',
            idMessage,
            timestamp: 1_700_000_000,
            senderData: {chatId: notificationChatId},
            messageData: {
                typeMessage: 'textMessage',
                textMessageData: {textMessage: 'Привет'},
            },
        },
    };
}

describe('useNotificationPolling', () => {
    beforeEach(() => {
        client.receiveNotification.mockReset();
        client.deleteNotification.mockReset();
        onMessage.mockReset();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('receives, appends, deletes, then requests the next notification', async () => {
        const calls: string[] = [];
        client.receiveNotification
            .mockImplementationOnce(async () => {
                calls.push('receive-1');
                return textNotification('message-1', chatId);
            })
            .mockImplementationOnce(() => new Promise(() => {}));
        client.deleteNotification.mockImplementation(async () => {
            calls.push('delete-1');
        });

        renderHook(() => useNotificationPolling({client, chatId, onMessage}));

        await waitFor(() => expect(client.receiveNotification).toHaveBeenCalledTimes(2));
        expect(onMessage).toHaveBeenCalledTimes(1);
        expect(calls).toEqual(['receive-1', 'delete-1']);
    });

    it('continues after null without exposing an error', async () => {
        client.receiveNotification
            .mockResolvedValueOnce(null)
            .mockImplementation(() => new Promise(() => {}));

        const {result} = renderHook(() => useNotificationPolling({client, chatId, onMessage}));

        await waitFor(() => expect(client.receiveNotification).toHaveBeenCalledTimes(2));
        expect(result.current.receiveError).toBeNull();
    });

    it('uses 1, 2, 5 and capped 10 second retry delays', async () => {
        vi.useFakeTimers();
        client.receiveNotification.mockRejectedValue(
            new GreenApiError('Сеть', 'network', null),
        );

        renderHook(() => useNotificationPolling({client, chatId, onMessage}));
        await act(async () => {});

        for (const delay of [1_000, 2_000, 5_000, 10_000, 10_000]) {
            const calls = client.receiveNotification.mock.calls.length;
            await act(async () => vi.advanceTimersByTimeAsync(delay - 1));
            expect(client.receiveNotification).toHaveBeenCalledTimes(calls);
            await act(async () => vi.advanceTimersByTimeAsync(1));
            expect(client.receiveNotification).toHaveBeenCalledTimes(calls + 1);
        }
    });

    it('stops after an authentication error', async () => {
        client.receiveNotification.mockRejectedValue(
            new GreenApiError('Доступ', 'auth', 401),
        );

        const {result} = renderHook(() => useNotificationPolling({client, chatId, onMessage}));

        await waitFor(() => expect(result.current.stopped).toBe(true));
        expect(client.receiveNotification).toHaveBeenCalledTimes(1);
    });

    it('retries deletion before receiving again and does not append twice', async () => {
        vi.useFakeTimers();
        client.receiveNotification
            .mockResolvedValueOnce(textNotification('same-id', chatId))
            .mockImplementation(() => new Promise(() => {}));
        client.deleteNotification
            .mockRejectedValueOnce(new GreenApiError('Сеть', 'network', null))
            .mockResolvedValueOnce();

        renderHook(() => useNotificationPolling({client, chatId, onMessage}));
        await act(async () => {});

        expect(onMessage).toHaveBeenCalledTimes(1);
        expect(client.receiveNotification).toHaveBeenCalledTimes(1);
        await act(async () => vi.advanceTimersByTimeAsync(1_000));
        expect(client.deleteNotification).toHaveBeenCalledTimes(2);
        expect(onMessage).toHaveBeenCalledTimes(1);
    });

    it('aborts the old request on chat change and on unmount', () => {
        client.receiveNotification.mockImplementation(() => new Promise(() => {}));
        const view = renderHook(
            ({currentChatId}) => useNotificationPolling({
                client,
                chatId: currentChatId,
                onMessage,
            }),
            {initialProps: {currentChatId: 'first@c.us'}},
        );
        const firstSignal = client.receiveNotification.mock.calls[0]?.[0];

        view.rerender({currentChatId: 'second@c.us'});

        expect(firstSignal?.aborted).toBe(true);
        const secondSignal = client.receiveNotification.mock.calls.at(-1)?.[0];
        view.unmount();
        expect(secondSignal?.aborted).toBe(true);
    });

    it('resets backoff after a successful receive', async () => {
        vi.useFakeTimers();
        client.receiveNotification
            .mockResolvedValueOnce(null)
            .mockRejectedValueOnce(new GreenApiError('Сеть', 'network', null))
            .mockImplementation(() => new Promise(() => {}));

        renderHook(() => useNotificationPolling({client, chatId, onMessage}));
        await act(async () => {});

        expect(client.receiveNotification).toHaveBeenCalledTimes(2);
        await act(async () => vi.advanceTimersByTimeAsync(999));
        expect(client.receiveNotification).toHaveBeenCalledTimes(2);
        await act(async () => vi.advanceTimersByTimeAsync(1));
        expect(client.receiveNotification).toHaveBeenCalledTimes(3);
    });
});
