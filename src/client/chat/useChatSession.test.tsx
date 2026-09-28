import {act, renderHook} from '@testing-library/react';
import {beforeEach, describe, expect, it} from 'vitest';
import {GreenApiError} from '../api/GreenApiError.js';
import {createGreenApiClientMock} from '../test/createGreenApiClientMock.js';
import type {ActiveChat} from './types.js';
import {useChatSession} from './useChatSession.js';

const client = createGreenApiClientMock();
const activeChat: ActiveChat = {chatId: '79991234567@c.us', phone: '+79991234567'};

function createDeferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((promiseResolve) => {
        resolve = promiseResolve;
    });
    return {promise, resolve};
}

describe('useChatSession', () => {
    beforeEach(() => {
        client.sendMessage.mockReset();
    });

    it('adds a message only after SendMessage succeeds', async () => {
        const deferred = createDeferred<{idMessage: string}>();
        client.sendMessage.mockReturnValue(deferred.promise);
        const {result} = renderHook(() => useChatSession(client, activeChat));

        act(() => result.current.setDraft('Привет'));
        act(() => void result.current.send());
        expect(result.current.messages).toEqual([]);
        expect(result.current.sending).toBe(true);

        await act(async () => deferred.resolve({idMessage: 'out-1'}));
        expect(result.current.messages[0]).toMatchObject({
            id: 'out-1',
            text: 'Привет',
            direction: 'outgoing',
        });
        expect(result.current.draft).toBe('');
        expect(client.sendMessage).toHaveBeenCalledWith(
            activeChat.chatId,
            'Привет',
            expect.any(AbortSignal),
        );
    });

    it('keeps the draft when sending fails', async () => {
        client.sendMessage.mockRejectedValue(new GreenApiError('Ошибка отправки', 'api', 500));
        const {result} = renderHook(() => useChatSession(client, activeChat));

        act(() => result.current.setDraft('Повторить'));
        await act(async () => result.current.send());

        expect(result.current.draft).toBe('Повторить');
        expect(result.current.sendError).toBe('Не удалось отправить сообщение');
    });

    it.each(['', '   '])('does not send a blank draft', async (draft) => {
        const {result} = renderHook(() => useChatSession(client, activeChat));

        act(() => result.current.setDraft(draft));
        await act(async () => result.current.send());

        expect(client.sendMessage).not.toHaveBeenCalled();
    });

    it('rejects a message longer than 20000 characters', async () => {
        const {result} = renderHook(() => useChatSession(client, activeChat));

        act(() => result.current.setDraft('x'.repeat(20_001)));
        await act(async () => result.current.send());

        expect(client.sendMessage).not.toHaveBeenCalled();
        expect(result.current.sendError).toContain('20 000');
    });

    it('ignores a second send while the first request is pending', () => {
        client.sendMessage.mockReturnValue(new Promise(() => {}));
        const {result} = renderHook(() => useChatSession(client, activeChat));

        act(() => result.current.setDraft('Один раз'));
        act(() => {
            void result.current.send();
            void result.current.send();
        });

        expect(client.sendMessage).toHaveBeenCalledTimes(1);
    });
});
