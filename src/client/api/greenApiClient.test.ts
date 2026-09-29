import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGreenApiClient } from './greenApiClient.js';

const credentials = {
    idInstance: '1100000001',
    apiTokenInstance: 'test-token',
};

const fetchMock = vi.fn<typeof fetch>();

describe('createGreenApiClient', () => {
    beforeEach(() => {
        fetchMock.mockReset();
    });

    it('requests the instance state', async () => {
        fetchMock.mockResolvedValue(new Response('{"stateInstance":"authorized"}', {status: 200}));
        const client = createGreenApiClient(credentials, fetchMock);

        await expect(client.getState()).resolves.toBe('authorized');
        expect(fetchMock).toHaveBeenCalledWith(
            'https://api.green-api.com/waInstance1100000001/getStateInstance/test-token',
            expect.objectContaining({method: 'GET'}),
        );
    });

    it('checks WhatsApp by chatId instead of the deprecated phoneNumber', async () => {
        fetchMock.mockResolvedValue(new Response(
            '{"existsWhatsapp":true,"chatId":"123456789012345@lid"}',
            {status: 200},
        ));
        const client = createGreenApiClient(credentials, fetchMock);

        await expect(client.checkWhatsapp('79991234567@c.us')).resolves.toEqual({
            existsWhatsapp: true,
            chatId: '123456789012345@lid',
        });
        expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
            chatId: '79991234567@c.us',
        });
    });

    it('returns a nullable chatId when WhatsApp is not found', async () => {
        fetchMock.mockResolvedValue(new Response('{"existsWhatsapp":false}', {status: 200}));
        const client = createGreenApiClient(credentials, fetchMock);

        await expect(client.checkWhatsapp('79991234567@c.us')).resolves.toEqual({
            existsWhatsapp: false,
            chatId: null,
        });
    });

    it('sends only chatId and message', async () => {
        fetchMock.mockResolvedValue(new Response('{"idMessage":"out-1"}', {status: 200}));
        const client = createGreenApiClient(credentials, fetchMock);

        await expect(client.sendMessage('79991234567@c.us', 'Привет')).resolves.toEqual({
            idMessage: 'out-1',
        });
        expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
            chatId: '79991234567@c.us',
            message: 'Привет',
        });
    });

    it('uses a five-second notification timeout', async () => {
        fetchMock.mockResolvedValue(new Response('', {status: 200}));
        const client = createGreenApiClient(credentials, fetchMock);

        await expect(client.receiveNotification()).resolves.toBeNull();
        expect(fetchMock.mock.calls[0]?.[0]).toBe(
            'https://api.green-api.com/waInstance1100000001/receiveNotification/test-token?receiveTimeout=5',
        );
    });

    it('returns a notification envelope', async () => {
        const notification = {receiptId: 17, body: {typeWebhook: 'incomingMessageReceived'}};
        fetchMock.mockResolvedValue(new Response(JSON.stringify(notification), {status: 200}));
        const client = createGreenApiClient(credentials, fetchMock);

        await expect(client.receiveNotification()).resolves.toEqual(notification);
    });

    it('deletes a notification by receiptId', async () => {
        fetchMock.mockResolvedValue(new Response(
            '{"result":true,"reason":""}',
            {status: 200},
        ));
        const client = createGreenApiClient(credentials, fetchMock);

        await expect(client.deleteNotification(42)).resolves.toBeUndefined();
        expect(fetchMock).toHaveBeenCalledWith(
            'https://api.green-api.com/waInstance1100000001/deleteNotification/test-token/42',
            expect.objectContaining({method: 'DELETE'}),
        );
    });

    it.each([
        [401, 'auth'],
        [403, 'auth'],
        [429, 'rate-limit'],
        [500, 'api'],
    ] as const)('maps HTTP %s to %s without exposing credentials', async (status, kind) => {
        fetchMock.mockResolvedValue(new Response('{}', {status}));
        const client = createGreenApiClient(credentials, fetchMock);

        const error = await client.getState().catch((reason: unknown) => reason);

        expect(error).toMatchObject({kind, status});
        expect(String(error)).not.toContain('test-token');
        expect(String(error)).not.toContain('https://api.green-api.com');
    });

    it('maps a rejected fetch to a network error without leaking its message', async () => {
        fetchMock.mockRejectedValue(new TypeError('Failed to fetch test-token URL'));
        const client = createGreenApiClient(credentials, fetchMock);

        const error = await client.getState().catch((reason: unknown) => reason);

        expect(error).toMatchObject({kind: 'network', status: null});
        expect(String(error)).not.toContain('test-token');
    });

    it.each(['not-json', '{}'])(
        'rejects an invalid state response: %s',
        async (body) => {
            fetchMock.mockResolvedValue(new Response(body, {status: 200}));
            const client = createGreenApiClient(credentials, fetchMock);

            await expect(client.getState()).rejects.toMatchObject({kind: 'invalid-response'});
        },
    );

    it('rejects malformed method responses', async () => {
        const client = createGreenApiClient(credentials, fetchMock);

        fetchMock.mockResolvedValueOnce(new Response('{"existsWhatsapp":"yes"}', {status: 200}));
        await expect(client.checkWhatsapp('79991234567@c.us')).rejects.toMatchObject({
            kind: 'invalid-response',
        });

        fetchMock.mockResolvedValueOnce(new Response('{"idMessage":7}', {status: 200}));
        await expect(client.sendMessage('79991234567@c.us', 'Привет')).rejects.toMatchObject({
            kind: 'invalid-response',
        });

        fetchMock.mockResolvedValueOnce(new Response('{"receiptId":"17"}', {status: 200}));
        await expect(client.receiveNotification()).rejects.toMatchObject({kind: 'invalid-response'});

        fetchMock.mockResolvedValueOnce(new Response(
            '{"result":false,"reason":"Notification not found"}',
            {status: 200},
        ));
        await expect(client.deleteNotification(17)).rejects.toMatchObject({kind: 'invalid-response'});
    });

    it('forwards an abort instead of converting it to a network error', async () => {
        const abort = new DOMException('Aborted', 'AbortError');
        fetchMock.mockRejectedValue(abort);
        const client = createGreenApiClient(credentials, fetchMock);

        await expect(client.getState()).rejects.toBe(abort);
    });
});
