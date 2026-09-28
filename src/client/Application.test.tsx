import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './Application.js';
import { GreenApiError } from './api/GreenApiError.js';
import type { InstanceState } from './api/types.js';
import { createGreenApiClientMock } from './test/createGreenApiClientMock.js';

afterEach(() => vi.unstubAllEnvs());

async function submitCredentials(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText('idInstance'), '1100000001');
    await user.type(screen.getByLabelText('apiTokenInstance'), 'test-token');
    await user.click(screen.getByRole('button', {name: 'Войти'}));
}

describe('Application', () => {
    it('prefills credentials from env only in development', () => {
        vi.stubEnv('DEV', true);
        vi.stubEnv('VITE_GREEN_API_ID_INSTANCE', 'dev-instance');
        vi.stubEnv('VITE_GREEN_API_TOKEN_INSTANCE', 'dev-token');

        const view = render(<App />);

        expect((screen.getByLabelText('idInstance') as HTMLInputElement).value).toBe('dev-instance');
        expect((screen.getByLabelText('apiTokenInstance') as HTMLInputElement).value).toBe('dev-token');

        view.unmount();
        vi.stubEnv('DEV', false);
        render(<App />);

        expect((screen.getByLabelText('idInstance') as HTMLInputElement).value).toBe('');
        expect((screen.getByLabelText('apiTokenInstance') as HTMLInputElement).value).toBe('');
    });

    it('opens the chat only after an authorized response', async () => {
        const user = userEvent.setup();
        const client = createGreenApiClientMock();
        client.getState.mockResolvedValue('authorized');

        render(<App clientFactory={() => client} />);

        await submitCredentials(user);

        expect(await screen.findByRole('button', {name: 'Новый чат'})).toBeTruthy();
        expect(client.getState).toHaveBeenCalledTimes(1);
    });

    it.each<InstanceState>(['notAuthorized', 'blocked', 'starting', 'futureState'])(
        'keeps login visible for state %s',
        async (state) => {
            const user = userEvent.setup();
            const client = createGreenApiClientMock();
            client.getState.mockResolvedValue(state);

            render(<App clientFactory={() => client} />);
            await submitCredentials(user);

            expect(await screen.findByRole('alert')).toBeTruthy();
            expect(screen.getByRole('button', {name: 'Войти'})).toBeTruthy();
            expect(screen.queryByRole('button', {name: 'Новый чат'})).toBeNull();
        },
    );

    it('shows a safe error when GREEN-API is unavailable', async () => {
        const user = userEvent.setup();
        const client = createGreenApiClientMock();
        client.getState.mockRejectedValue(
            new GreenApiError('Не удалось подключиться к GREEN-API', 'network', null),
        );

        render(<App clientFactory={() => client} />);
        await submitCredentials(user);

        expect((await screen.findByRole('alert')).textContent).toContain('подключиться');
        expect(screen.getByRole('alert').textContent).not.toContain('test-token');
    });

    it('prevents duplicate submits while the instance check is pending', async () => {
        const user = userEvent.setup();
        const client = createGreenApiClientMock();
        client.getState.mockImplementation(() => new Promise(() => {}));

        render(<App clientFactory={() => client} />);
        await submitCredentials(user);

        const button = screen.getByRole('button', {name: 'Проверяем…'}) as HTMLButtonElement;
        expect(button.disabled).toBe(true);
        await user.click(button);
        expect(client.getState).toHaveBeenCalledTimes(1);
    });
});
