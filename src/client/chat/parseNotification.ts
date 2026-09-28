import type {NotificationEnvelope} from '../api/types.js';
import type {ChatMessage} from './types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

export function parseIncomingText(
    envelope: NotificationEnvelope,
    activeChatId: string,
): ChatMessage | null {
    const body = envelope.body;

    if (!isRecord(body) || body.typeWebhook !== 'incomingMessageReceived') {
        return null;
    }
    if (!isRecord(body.senderData) || body.senderData.chatId !== activeChatId) {
        return null;
    }
    if (!isRecord(body.messageData) || typeof body.idMessage !== 'string') {
        return null;
    }

    let text: string | null = null;

    if (body.messageData.typeMessage === 'textMessage') {
        const data = body.messageData.textMessageData;
        if (isRecord(data) && typeof data.textMessage === 'string') {
            text = data.textMessage;
        }
    }
    if (body.messageData.typeMessage === 'extendedTextMessage') {
        const data = body.messageData.extendedTextMessageData;
        if (isRecord(data) && typeof data.text === 'string') {
            text = data.text;
        }
    }
    if (text === null || typeof body.timestamp !== 'number') {
        return null;
    }

    const timestamp = body.timestamp * 1000;
    if (!Number.isFinite(timestamp) || timestamp < 0 || timestamp > 8_640_000_000_000_000) {
        return null;
    }

    return {
        id: body.idMessage,
        text,
        timestamp,
        direction: 'incoming',
    };
}
