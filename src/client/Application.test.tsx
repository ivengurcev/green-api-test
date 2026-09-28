import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './Application.js';

afterEach(() => vi.unstubAllEnvs());

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

    it('opens the chat after credentials are submitted', async () => {
        const user = userEvent.setup();

        render(<App />);

        await user.type(screen.getByLabelText('idInstance'), '123456');
        await user.type(screen.getByLabelText('apiTokenInstance'), 'secret-token');
        await user.click(screen.getByRole('button', { name: 'Войти' }));

        expect(screen.getByRole('main').textContent).toContain('MAX Chat');
        expect(screen.getByRole('button', { name: 'Новый чат' })).toBeTruthy();
        expect(screen.getByText('Это тестовое сообщение из MAX')).toBeTruthy();
    });
});
