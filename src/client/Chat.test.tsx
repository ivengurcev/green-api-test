import {render, screen, waitFor, within} from '@testing-library/react';
import {userEvent} from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {GreenApiError} from './api/GreenApiError.js';
import type {CheckedWhatsapp} from './api/types.js';
import Chat from './Chat.js';
import {createGreenApiClientMock} from './test/createGreenApiClientMock.js';

const client = createGreenApiClientMock();
const chatId = '79991234567@c.us';

function textNotification(idMessage: string, text: string) {
    return {
        receiptId: 11,
        body: {
            typeWebhook: 'incomingMessageReceived',
            idMessage,
            timestamp: 1_700_000_000,
            senderData: {chatId},
            messageData: {
                typeMessage: 'textMessage',
                textMessageData: {textMessage: text},
            },
        },
    };
}

async function submitNewChat(user: ReturnType<typeof userEvent.setup>, phone: string) {
    await user.click(screen.getByRole('button', {name: 'Новый чат'}));
    await user.clear(screen.getByLabelText('Номер телефона'));
    await user.type(screen.getByLabelText('Номер телефона'), phone);
    await user.click(screen.getByRole('button', {name: 'Создать чат'}));
}

describe('Chat', () => {
    beforeEach(() => {
        client.checkWhatsapp.mockReset();
        client.receiveNotification.mockReset();
        client.receiveNotification.mockImplementation(() => new Promise(() => {}));
        client.deleteNotification.mockReset();
        client.deleteNotification.mockResolvedValue();
        client.sendMessage.mockReset();
    });

    it('checks WhatsApp using the normalized personal chatId', async () => {
        const user = userEvent.setup();
        client.checkWhatsapp.mockResolvedValue({
            existsWhatsapp: true,
            chatId: '123456789012345@lid',
        });

        render(<Chat client={client} />);
        await submitNewChat(user, '+7 (999) 123-45-67');

        expect((await screen.findAllByText('+79991234567')).length).toBeGreaterThan(0);
        expect(client.checkWhatsapp).toHaveBeenCalledWith(
            '79991234567@c.us',
            expect.any(AbortSignal),
        );
    });

    it('displays a c.us notification when CheckWhatsapp returns a LID', async () => {
        const user = userEvent.setup();
        client.checkWhatsapp.mockResolvedValue({
            existsWhatsapp: true,
            chatId: '123456789012345@lid',
        });
        client.receiveNotification
            .mockReset()
            .mockResolvedValueOnce(textNotification('incoming-lid', 'Ответ через LID'))
            .mockImplementation(() => new Promise(() => {}));

        render(<Chat client={client} />);
        await submitNewChat(user, '79991234567');

        expect(await screen.findByText('Ответ через LID')).toBeTruthy();
    });

    it('does not replace the current chat when the next number is invalid', async () => {
        const user = userEvent.setup();
        client.checkWhatsapp
            .mockResolvedValueOnce({existsWhatsapp: true, chatId: '79991234567@c.us'})
            .mockResolvedValueOnce({existsWhatsapp: false, chatId: null});

        render(<Chat client={client} />);
        await submitNewChat(user, '79991234567');
        await submitNewChat(user, '79997654321');

        expect((await screen.findByRole('alert')).textContent).toContain('WhatsApp');
        expect(screen.getAllByText('+79991234567').length).toBeGreaterThan(0);
    });

    it('rejects an invalid phone without calling GREEN-API', async () => {
        const user = userEvent.setup();

        render(<Chat client={client} />);
        await submitNewChat(user, '123');

        expect((await screen.findByRole('alert')).textContent).toContain('11–16 цифр');
        expect(client.checkWhatsapp).not.toHaveBeenCalled();
    });

    it('ignores a stale phone-check response', async () => {
        const user = userEvent.setup();
        let resolveFirst!: (value: CheckedWhatsapp) => void;
        const first = new Promise<CheckedWhatsapp>((resolve) => {
            resolveFirst = resolve;
        });
        client.checkWhatsapp
            .mockReturnValueOnce(first)
            .mockResolvedValueOnce({existsWhatsapp: true, chatId: '79997654321@c.us'});

        render(<Chat client={client} />);
        void submitNewChat(user, '79991234567');
        await waitFor(() => expect(client.checkWhatsapp).toHaveBeenCalledTimes(1));
        await user.click(await screen.findByRole('button', {name: 'Закрыть'}));
        await submitNewChat(user, '79997654321');
        resolveFirst({existsWhatsapp: true, chatId: '79991234567@c.us'});

        expect((await screen.findAllByText('+79997654321')).length).toBeGreaterThan(0);
        expect(screen.queryByText('+79991234567')).toBeNull();
    });

    it('returns from the conversation without deleting the current session', async () => {
        const user = userEvent.setup();
        client.checkWhatsapp.mockResolvedValue({existsWhatsapp: true, chatId});
        client.receiveNotification
            .mockReset()
            .mockResolvedValueOnce(textNotification('incoming-1', 'Входящее сообщение'))
            .mockImplementation(() => new Promise(() => {}));

        render(<Chat client={client} />);
        await submitNewChat(user, '79991234567');
        expect(await screen.findByText('Входящее сообщение')).toBeTruthy();

        await user.click(screen.getByRole('button', {name: 'Назад к чатам'}));
        await user.click(screen.getByRole('button', {name: /7999/}));

        expect(screen.getByText('Входящее сообщение')).toBeTruthy();
    });

    it('starts a fresh session when the same chat is created again', async () => {
        const user = userEvent.setup();
        client.checkWhatsapp.mockResolvedValue({existsWhatsapp: true, chatId});
        client.receiveNotification
            .mockReset()
            .mockResolvedValueOnce(textNotification('incoming-1', 'Старая история'))
            .mockImplementation(() => new Promise(() => {}));

        render(<Chat client={client} />);
        await submitNewChat(user, '79991234567');
        expect(await screen.findByText('Старая история')).toBeTruthy();

        await submitNewChat(user, '79991234567');

        await waitFor(() => expect(screen.queryByText('Старая история')).toBeNull());
        expect(client.receiveNotification).toHaveBeenCalledTimes(3);
    });

    it('exposes async errors to assistive technologies', async () => {
        const user = userEvent.setup();
        client.checkWhatsapp.mockResolvedValue({existsWhatsapp: true, chatId});
        client.sendMessage.mockRejectedValue(new GreenApiError('Ошибка', 'api', 500));

        render(<Chat client={client} />);
        await submitNewChat(user, '79991234567');
        await user.type(screen.getByLabelText('Сообщение'), 'Не отправится');
        await user.click(screen.getByRole('button', {name: 'Отправить'}));

        expect((await screen.findByRole('alert')).textContent).toContain('Не удалось отправить');
    });

    it('offers a new login after polling authentication expires', async () => {
        const user = userEvent.setup();
        const onLogout = vi.fn();
        client.checkWhatsapp.mockResolvedValue({existsWhatsapp: true, chatId});
        client.receiveNotification.mockRejectedValue(
            new GreenApiError('Доступ', 'auth', 401),
        );

        render(<Chat client={client} onLogout={onLogout} />);
        await submitNewChat(user, '79991234567');
        await user.click(await screen.findByRole('button', {name: 'Войти заново'}));

        expect(onLogout).toHaveBeenCalledTimes(1);
    });

    it('provides accessible names for chat controls and inputs', async () => {
        const user = userEvent.setup();
        client.checkWhatsapp.mockResolvedValue({existsWhatsapp: true, chatId});

        render(<Chat client={client} />);
        expect(screen.getByRole('button', {name: 'Новый чат'})).toBeTruthy();
        await submitNewChat(user, '79991234567');

        expect(screen.getByRole('button', {name: 'Отправить'})).toBeTruthy();
        expect(screen.getByRole('button', {name: 'Назад к чатам'})).toBeTruthy();
        const messageInput = screen.getByLabelText('Сообщение') as HTMLInputElement;
        expect(messageInput.labels).toHaveLength(1);
    });

    it('announces phone checks and message sending', async () => {
        const user = userEvent.setup();
        client.checkWhatsapp.mockResolvedValueOnce({existsWhatsapp: true, chatId});
        client.sendMessage.mockImplementation(() => new Promise(() => {}));

        render(<Chat client={client} />);
        await submitNewChat(user, '79991234567');
        await user.type(screen.getByLabelText('Сообщение'), 'Ожидает отправки');
        await user.click(screen.getByRole('button', {name: 'Отправить'}));
        expect(screen.getByRole('status').textContent).toContain('Сообщение отправляется');

        await user.click(screen.getByRole('button', {name: 'Новый чат'}));
        await user.type(screen.getByLabelText('Номер телефона'), '79997654321');
        client.checkWhatsapp.mockImplementationOnce(() => new Promise(() => {}));
        await user.click(screen.getByRole('button', {name: 'Создать чат'}));
        expect(within(screen.getByRole('dialog')).getByRole('status').textContent)
            .toContain('Проверяем номер');
    });

    it('traps modal focus and restores a logical focus target after closing', async () => {
        const user = userEvent.setup();
        client.checkWhatsapp.mockResolvedValue({existsWhatsapp: true, chatId});

        render(<Chat client={client} />);
        const trigger = screen.getByRole('button', {name: 'Новый чат'});
        await user.click(trigger);

        expect(document.activeElement).toBe(screen.getByLabelText('Номер телефона'));
        expect(screen.getByRole('main').querySelector('[inert]')).toBeTruthy();
        const submit = screen.getByRole('button', {name: 'Создать чат'});
        submit.focus();
        await user.tab();
        expect(document.activeElement).toBe(screen.getByRole('button', {name: 'Закрыть'}));
        await user.keyboard('{Escape}');
        await waitFor(() => expect(document.activeElement).toBe(trigger));
        expect(screen.queryByRole('dialog')).toBeNull();

        await submitNewChat(user, '79991234567');
        await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Сообщение')));
    });
});
