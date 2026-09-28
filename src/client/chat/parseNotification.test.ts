import {describe, expect, it} from 'vitest';
import type {NotificationEnvelope} from '../api/types.js';
import {parseIncomingText} from './parseNotification.js';

const activeChatId = '79991234567@c.us';

function notification(body: Record<string, unknown>): NotificationEnvelope {
    return {
        receiptId: 1,
        body: {
            typeWebhook: 'incomingMessageReceived',
            ...body,
        },
    };
}

describe('parseIncomingText', () => {
    it.each([
        ['textMessage', {textMessageData: {textMessage: 'Привет'}}, 'Привет'],
        [
            'extendedTextMessage',
            {extendedTextMessageData: {text: 'https://example.com'}},
            'https://example.com',
        ],
    ])('parses %s', (typeMessage, payload, expected) => {
        const envelope = notification({
            idMessage: 'incoming-1',
            timestamp: 1_700_000_000,
            senderData: {chatId: activeChatId},
            messageData: {typeMessage, ...payload},
        });

        expect(parseIncomingText(envelope, activeChatId)).toEqual({
            id: 'incoming-1',
            text: expected,
            timestamp: 1_700_000_000_000,
            direction: 'incoming',
        });
    });

    it.each([
        [
            'another chat',
            notification({
                idMessage: '1',
                timestamp: 1,
                senderData: {chatId: 'another@c.us'},
                messageData: {
                    typeMessage: 'textMessage',
                    textMessageData: {textMessage: 'x'},
                },
            }),
        ],
        ['another webhook', notification({typeWebhook: 'outgoingMessageStatus'})],
        [
            'media',
            notification({
                idMessage: '2',
                timestamp: 1,
                senderData: {chatId: activeChatId},
                messageData: {typeMessage: 'imageMessage'},
            }),
        ],
        [
            'quoted message',
            notification({
                idMessage: '3',
                timestamp: 1,
                senderData: {chatId: activeChatId},
                messageData: {typeMessage: 'quotedMessage'},
            }),
        ],
        ['missing fields', {receiptId: 4, body: {}}],
        ['non-object body', {receiptId: 5, body: 'broken'}],
        [
            'non-finite timestamp',
            notification({
                idMessage: '4',
                timestamp: Number.NaN,
                senderData: {chatId: activeChatId},
                messageData: {
                    typeMessage: 'textMessage',
                    textMessageData: {textMessage: 'x'},
                },
            }),
        ],
        [
            'timestamp outside the Date range',
            notification({
                idMessage: '5',
                timestamp: 8_640_000_000_001,
                senderData: {chatId: activeChatId},
                messageData: {
                    typeMessage: 'textMessage',
                    textMessageData: {textMessage: 'x'},
                },
            }),
        ],
    ] satisfies ReadonlyArray<readonly [string, NotificationEnvelope]>) (
        'returns null for %s',
        (_name, envelope) => {
            expect(parseIncomingText(envelope, activeChatId)).toBeNull();
        },
    );
});
