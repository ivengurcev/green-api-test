import {render, screen, waitFor} from '@testing-library/react';
import {userEvent} from '@testing-library/user-event';
import {beforeEach, describe, expect, it} from 'vitest';
import type {CheckedWhatsapp} from './api/types.js';
import Chat from './Chat.js';
import {createGreenApiClientMock} from './test/createGreenApiClientMock.js';

const client = createGreenApiClientMock();

async function submitNewChat(user: ReturnType<typeof userEvent.setup>, phone: string) {
    await user.click(screen.getByRole('button', {name: 'Новый чат'}));
    await user.clear(screen.getByLabelText('Номер телефона'));
    await user.type(screen.getByLabelText('Номер телефона'), phone);
    await user.click(screen.getByRole('button', {name: 'Создать чат'}));
}

describe('Chat', () => {
    beforeEach(() => {
        client.checkWhatsapp.mockReset();
    });

    it('creates a chat using the chatId returned by GREEN-API', async () => {
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
});
