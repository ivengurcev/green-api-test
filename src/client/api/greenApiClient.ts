import { GreenApiError } from './GreenApiError.js';
import type {
    Credentials,
    GreenApiClient,
} from './types.js';

const API_URL = 'https://api.green-api.com';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

export function createGreenApiClient(
    credentials: Credentials,
    fetchImpl: typeof fetch = fetch,
): GreenApiClient {
    const instance = encodeURIComponent(credentials.idInstance.trim());
    const token = encodeURIComponent(credentials.apiTokenInstance);
    const baseUrl = `${API_URL}/waInstance${instance}`;

    async function request(
        method: 'GET' | 'POST' | 'DELETE',
        path: string,
        body?: unknown,
        signal?: AbortSignal,
        search = '',
        suffix = '',
        allowEmptyResponse = false,
    ): Promise<unknown> {
        let response: Response;

        try {
            response = await fetchImpl(`${baseUrl}/${path}/${token}${suffix}${search}`, {
                method,
                ...(signal ? {signal} : {}),
                ...(body === undefined ? {} : {
                    body: JSON.stringify(body),
                    headers: {'Content-Type': 'application/json'},
                }),
            });
        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') {
                throw error;
            }

            throw new GreenApiError('Не удалось подключиться к GREEN-API', 'network', null);
        }

        if (!response.ok) {
            const kind = response.status === 401 || response.status === 403
                ? 'auth'
                : response.status === 429
                    ? 'rate-limit'
                    : 'api';

            throw new GreenApiError('GREEN-API отклонил запрос', kind, response.status);
        }

        try {
            const responseText = await response.text();
            if (allowEmptyResponse && responseText.trim() === '') {
                return null;
            }

            return JSON.parse(responseText) as unknown;
        } catch {
            throw new GreenApiError(
                'GREEN-API вернул некорректный ответ',
                'invalid-response',
                response.status,
            );
        }
    }

    function invalidResponse(): never {
        throw new GreenApiError('GREEN-API вернул некорректный ответ', 'invalid-response', 200);
    }

    return {
        async getState(signal) {
            const data = await request('GET', 'getStateInstance', undefined, signal);

            if (!isRecord(data) || typeof data.stateInstance !== 'string') {
                invalidResponse();
            }

            return data.stateInstance;
        },

        async checkWhatsapp(chatId, signal) {
            const data = await request('POST', 'checkWhatsapp', {chatId}, signal);

            if (!isRecord(data) || typeof data.existsWhatsapp !== 'boolean') {
                invalidResponse();
            }

            if (data.chatId !== undefined && typeof data.chatId !== 'string') {
                invalidResponse();
            }

            return {
                existsWhatsapp: data.existsWhatsapp,
                chatId: data.chatId ?? null,
            };
        },

        async sendMessage(chatId, message, signal) {
            const data = await request('POST', 'sendMessage', {chatId, message}, signal);

            if (!isRecord(data) || typeof data.idMessage !== 'string') {
                invalidResponse();
            }

            return {idMessage: data.idMessage};
        },

        async receiveNotification(signal) {
            const data = await request(
                'GET',
                'receiveNotification',
                undefined,
                signal,
                '?receiveTimeout=5',
                '',
                true,
            );

            if (data === null) {
                return null;
            }

            if (!isRecord(data) || typeof data.receiptId !== 'number' || !('body' in data)) {
                invalidResponse();
            }

            return {
                receiptId: data.receiptId,
                body: data.body,
            };
        },

        async deleteNotification(receiptId, signal) {
            const data = await request(
                'DELETE',
                'deleteNotification',
                undefined,
                signal,
                '',
                `/${receiptId}`,
            );

            if (!isRecord(data) || data.result !== true) {
                invalidResponse();
            }
        },
    };
}
