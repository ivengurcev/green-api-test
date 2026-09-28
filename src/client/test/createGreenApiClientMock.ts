import { vi } from 'vitest';
import type { GreenApiClient } from '../api/types.js';

export function createGreenApiClientMock() {
    return {
        getState: vi.fn<GreenApiClient['getState']>(),
        checkWhatsapp: vi.fn<GreenApiClient['checkWhatsapp']>(),
        sendMessage: vi.fn<GreenApiClient['sendMessage']>(),
        receiveNotification: vi.fn<GreenApiClient['receiveNotification']>(),
        deleteNotification: vi.fn<GreenApiClient['deleteNotification']>(),
    } satisfies GreenApiClient;
}
