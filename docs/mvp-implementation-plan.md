# WhatsApp Chat MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Реализовать адаптивный frontend-only чат для проверки инстанса GREEN-API, создания одного WhatsApp-чата, отправки и получения текстовых сообщений.

**Architecture:** React-компоненты работают с одним типизированным `GreenApiClient`, который инкапсулирует все вызовы `fetch`. Состояние сессии хранится только в памяти; входящие уведомления читает один отменяемый последовательный polling-цикл с дедупликацией и backoff.

**Tech Stack:** React 19, TypeScript 7, Vite 8, CSS Modules, Vitest 5, Testing Library, Fetch API.

**Spec:** `docs/mvp-requirements.md`

## Global Constraints

- Приложение остаётся frontend-only; backend, proxy, BFF и серверное хранение запрещены.
- Используется универсальный хост `https://api.green-api.com`.
- Разрешены только `GetStateInstance`, `CheckWhatsapp`, `SendMessage`, `ReceiveNotification` и `DeleteNotification`.
- Поддерживается один активный чат; новый успешно проверенный чат заменяет предыдущий.
- Реквизиты, чат и сообщения хранятся только в памяти и очищаются после перезагрузки.
- Входящие `textMessage` и `extendedTextMessage` отображаются; прочие события подтверждаются без отображения.
- Polling строго последовательный, отменяемый и единственный для текущей вкладки.
- Desktop layout используется от `768px`, mobile layout — от `320px` до `767px`.
- Компонентные стили остаются в CSS Modules, общие значения — в `src/client/styles/tokens.css`.
- Реальные реквизиты GREEN-API запрещено добавлять в код, тесты, документацию и Git.
- Каждый продуктовый шаг выполняется через TDD; тесты не обращаются к реальному GREEN-API.

## Review Focus

- Номер со скобками, пробелами и `+` нормализуется, а значение короче 11 или длиннее 16 цифр отклоняется — закрепить в Task 2.
- Неизвестный или будущий `stateInstance` не пропускает пользователя в чат и отображается безопасно — закрепить в Task 4.
- Устаревший ответ проверки номера не заменяет более новый активный чат — закрепить в Task 5.
- Ошибка `DeleteNotification` не запускает параллельный `ReceiveNotification` и не дублирует уже показанное сообщение — закрепить в Task 8.
- Размонтирование или замена чата отменяет активный long-poll и не обновляет старое состояние — закрепить в Task 8.

---

### Task 1: Удалить backend-заготовку и установить единый контур проверок

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `tsconfig.json`
- Delete: `src/server/index.ts`

**Interfaces:**
- Consumes: текущие команды Vite и Vitest.
- Produces: команды `dev`, `build`, `typecheck`, `test`, `test:watch`, `check`.

- [ ] **Step 1: Зафиксировать отсутствие общей команды проверки**

Run:

```bash
pnpm run check
```

Expected: FAIL с сообщением об отсутствующем script `check`.

- [ ] **Step 2: Обновить scripts и удалить серверные зависимости**

Привести соответствующую часть `package.json` к виду:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "check": "pnpm typecheck && pnpm test && pnpm build"
  },
  "dependencies": {
    "react": "^19.3.0",
    "react-dom": "^19.3.0"
  }
}
```

Удалить `@hono/node-server`, `hono`, `tsx` и файл `src/server/index.ts`. Обновить lockfile командой:

```bash
pnpm install --lockfile-only
```

В `tsconfig.json` отключить генерацию деклараций, потому что проект собирается Vite и не публикуется как библиотека:

```json
{
  "compilerOptions": {
    "sourceMap": true,
    "declaration": false,
    "declarationMap": false
  }
}
```

- [ ] **Step 3: Запустить новый контур проверки**

Run:

```bash
pnpm run check
```

Expected: PASS; TypeScript, существующие тесты и production-сборка завершаются с кодом `0`.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml tsconfig.json src/server/index.ts
git commit -m "chore: remove unused backend scaffold"
```

---

### Task 2: Добавить нормализацию и проверку номера

**Files:**
- Create: `src/client/chat/phone.ts`
- Create: `src/client/chat/phone.test.ts`

**Interfaces:**
- Consumes: строку, введённую пользователем.
- Produces: `normalizePhone(value: string): string` и `toPersonalChatId(phone: string): string`.

- [ ] **Step 1: Написать падающие тесты номера**

```ts
import { describe, expect, it } from 'vitest';
import { normalizePhone, toPersonalChatId } from './phone.js';

describe('normalizePhone', () => {
    it('removes supported formatting characters', () => {
        expect(normalizePhone('+7 (999) 123-45-67')).toBe('79991234567');
    });

    it.each(['7999123456', '12345678901234567', '7999abc4567'])(
        'rejects invalid phone %s',
        (phone) => expect(() => normalizePhone(phone)).toThrow('Введите номер из 11–16 цифр'),
    );
});

it('builds a personal WhatsApp chat id', () => {
    expect(toPersonalChatId('79991234567')).toBe('79991234567@c.us');
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run:

```bash
pnpm vitest run src/client/chat/phone.test.ts
```

Expected: FAIL, модуль `phone.js` не найден.

- [ ] **Step 3: Реализовать минимальные чистые функции**

```ts
const FORMATTING_CHARACTERS = /[+\s()-]/g;
const VALID_PHONE = /^\d{11,16}$/;

export function normalizePhone(value: string): string {
    const phone = value.trim().replace(FORMATTING_CHARACTERS, '');
    if (!VALID_PHONE.test(phone)) {
        throw new Error('Введите номер из 11–16 цифр');
    }
    return phone;
}

export function toPersonalChatId(phone: string): string {
    return `${phone}@c.us`;
}
```

- [ ] **Step 4: Запустить тесты номера**

Run:

```bash
pnpm vitest run src/client/chat/phone.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/client/chat/phone.ts src/client/chat/phone.test.ts
git commit -m "feat: validate WhatsApp phone numbers"
```

---

### Task 3: Создать типизированный REST-клиент GREEN-API

**Files:**
- Create: `src/client/api/types.ts`
- Create: `src/client/api/GreenApiError.ts`
- Create: `src/client/api/greenApiClient.ts`
- Create: `src/client/api/greenApiClient.test.ts`
- Create: `src/client/test/createGreenApiClientMock.ts`
- Modify: `src/client/useCredentials.ts`

**Interfaces:**
- Consumes: `Credentials`, необязательный `fetchImpl` для тестов и `AbortSignal` для отмены.
- Produces: `GreenApiClient`, `createGreenApiClient`, `GreenApiError`, типы ответов и уведомлений.

- [ ] **Step 1: Определить публичные контракты**

Создать `src/client/api/types.ts`:

```ts
export type Credentials = {
    idInstance: string;
    apiTokenInstance: string;
};

export type InstanceState =
    | 'authorized'
    | 'notAuthorized'
    | 'blocked'
    | 'sleepMode'
    | 'starting'
    | 'yellowCard'
    | 'suspended'
    | (string & {});

export type CheckedWhatsapp = {
    existsWhatsapp: boolean;
    chatId: string | null;
};

export type NotificationEnvelope = {
    receiptId: number;
    body: unknown;
};

export type GreenApiClient = {
    getState(signal?: AbortSignal): Promise<InstanceState>;
    checkWhatsapp(chatId: string, signal?: AbortSignal): Promise<CheckedWhatsapp>;
    sendMessage(chatId: string, message: string, signal?: AbortSignal): Promise<{idMessage: string}>;
    receiveNotification(signal?: AbortSignal): Promise<NotificationEnvelope | null>;
    deleteNotification(receiptId: number, signal?: AbortSignal): Promise<void>;
};
```

Перенести `Credentials` из `useCredentials.ts` в этот файл и реэкспортировать его из hook-файла только если это нужно существующим imports.

Создать общий строго типизированный mock для компонентных тестов:

```ts
import {vi} from 'vitest';
import type {GreenApiClient} from '../api/types.js';

export function createGreenApiClientMock() {
    return {
        getState: vi.fn<GreenApiClient['getState']>(),
        checkWhatsapp: vi.fn<GreenApiClient['checkWhatsapp']>(),
        sendMessage: vi.fn<GreenApiClient['sendMessage']>(),
        receiveNotification: vi.fn<GreenApiClient['receiveNotification']>(),
        deleteNotification: vi.fn<GreenApiClient['deleteNotification']>(),
    } satisfies GreenApiClient;
}
```

- [ ] **Step 2: Написать падающие тесты всех методов**

В `greenApiClient.test.ts` создать mock `fetch` и проверить:

```ts
const credentials = {idInstance: '1100000001', apiTokenInstance: 'test-token'};
const fetchMock = vi.fn<typeof fetch>();
const client = createGreenApiClient(credentials, fetchMock);

it('requests the instance state', async () => {
    fetchMock.mockResolvedValue(new Response('{"stateInstance":"authorized"}', {status: 200}));
    await expect(client.getState()).resolves.toBe('authorized');
    expect(fetchMock).toHaveBeenCalledWith(
        'https://api.green-api.com/waInstance1100000001/getStateInstance/test-token',
        expect.objectContaining({method: 'GET'}),
    );
});

it('checks WhatsApp by chatId, not deprecated phoneNumber', async () => {
    fetchMock.mockResolvedValue(new Response(
        '{"existsWhatsapp":true,"chatId":"123456789012345@lid"}',
        {status: 200},
    ));
    await expect(client.checkWhatsapp('79991234567@c.us')).resolves.toEqual({
        existsWhatsapp: true,
        chatId: '123456789012345@lid',
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
        chatId: '79991234567@c.us',
    });
});

it('uses a five-second notification timeout', async () => {
    fetchMock.mockResolvedValue(new Response('null', {status: 200}));
    await expect(client.receiveNotification()).resolves.toBeNull();
    expect(fetchMock.mock.calls[0]?.[0]).toContain('receiveTimeout=5');
});
```

Добавить точные проверки остальных операций и ошибок:

```ts
it('sends only chatId and message', async () => {
    fetchMock.mockResolvedValue(new Response('{"idMessage":"out-1"}', {status: 200}));
    await expect(client.sendMessage('79991234567@c.us', 'Привет')).resolves.toEqual({idMessage: 'out-1'});
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
        chatId: '79991234567@c.us',
        message: 'Привет',
    });
});

it('deletes a notification by receiptId', async () => {
    fetchMock.mockResolvedValue(new Response('true', {status: 200}));
    await expect(client.deleteNotification(42)).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/deleteNotification/test-token/42');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({method: 'DELETE'});
});

it.each([
    [401, 'auth'],
    [429, 'rate-limit'],
    [500, 'api'],
] as const)('maps HTTP %s to %s without exposing credentials', async (status, kind) => {
    fetchMock.mockResolvedValue(new Response('{}', {status}));
    const error = await client.getState().catch((reason: unknown) => reason);
    expect(error).toMatchObject({kind, status});
    expect(String(error)).not.toContain('test-token');
    expect(String(error)).not.toContain('https://api.green-api.com');
});

it('maps a rejected fetch to a network error', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch secret URL'));
    await expect(client.getState()).rejects.toMatchObject({kind: 'network', status: null});
});

it.each(['not-json', '{}'])(
    'rejects an invalid state response: %s',
    async (body) => {
        fetchMock.mockResolvedValue(new Response(body, {status: 200}));
        await expect(client.getState()).rejects.toMatchObject({kind: 'invalid-response'});
    },
);
```

- [ ] **Step 3: Убедиться, что тесты падают**

Run:

```bash
pnpm vitest run src/client/api/greenApiClient.test.ts
```

Expected: FAIL, реализации клиента нет.

- [ ] **Step 4: Реализовать безопасную ошибку и transport**

`GreenApiError` должен иметь только безопасные поля:

```ts
export type GreenApiErrorKind =
    | 'auth'
    | 'rate-limit'
    | 'network'
    | 'api'
    | 'invalid-response';

export class GreenApiError extends Error {
    constructor(
        message: string,
        readonly kind: GreenApiErrorKind,
        readonly status: number | null,
    ) {
        super(message);
        this.name = 'GreenApiError';
    }
}
```

В `greenApiClient.ts` реализовать один приватный transport и все пять методов:

```ts
const API_URL = 'https://api.green-api.com';

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
            if (error instanceof DOMException && error.name === 'AbortError') throw error;
            throw new GreenApiError('Не удалось подключиться к GREEN-API', 'network', null);
        }
        if (!response.ok) {
            const kind = response.status === 401 || response.status === 403
                ? 'auth'
                : response.status === 429 ? 'rate-limit' : 'api';
            throw new GreenApiError('GREEN-API отклонил запрос', kind, response.status);
        }
        try {
            return await response.json() as unknown;
        } catch {
            throw new GreenApiError('GREEN-API вернул некорректный ответ', 'invalid-response', response.status);
        }
    }

    function invalidResponse(): never {
        throw new GreenApiError('GREEN-API вернул некорректный ответ', 'invalid-response', 200);
    }

    return {
        async getState(signal) {
            const data = await request('GET', 'getStateInstance', undefined, signal);
            if (!isRecord(data) || typeof data.stateInstance !== 'string') invalidResponse();
            return data.stateInstance;
        },
        async checkWhatsapp(chatId, signal) {
            const data = await request('POST', 'checkWhatsapp', {chatId}, signal);
            if (!isRecord(data) || typeof data.existsWhatsapp !== 'boolean') invalidResponse();
            if (data.chatId !== undefined && typeof data.chatId !== 'string') invalidResponse();
            return {existsWhatsapp: data.existsWhatsapp, chatId: data.chatId ?? null};
        },
        async sendMessage(chatId, message, signal) {
            const data = await request('POST', 'sendMessage', {chatId, message}, signal);
            if (!isRecord(data) || typeof data.idMessage !== 'string') invalidResponse();
            return {idMessage: data.idMessage};
        },
        async receiveNotification(signal) {
            const data = await request(
                'GET',
                'receiveNotification',
                undefined,
                signal,
                '?receiveTimeout=5',
            );
            if (data === null) return null;
            if (!isRecord(data) || typeof data.receiptId !== 'number' || !('body' in data)) {
                invalidResponse();
            }
            return {receiptId: data.receiptId, body: data.body};
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
            if (data !== true) invalidResponse();
        },
    };
}
```

Добавить рядом `isRecord(value: unknown)` из Task 7. Обратите внимание: `receiveNotification` передаёт query через отдельный `search`, поэтому `receiveTimeout=5` находится после токена. `deleteNotification` передаёт `receiptId` через `suffix`, чтобы он также находился после токена; итоговый URL обязан совпасть с тестом.

- [ ] **Step 5: Запустить тесты клиента и полный typecheck**

Run:

```bash
pnpm vitest run src/client/api/greenApiClient.test.ts
pnpm typecheck
```

Expected: обе команды PASS.

- [ ] **Step 6: Commit**

```bash
git add src/client/api src/client/test/createGreenApiClientMock.ts src/client/useCredentials.ts
git commit -m "feat: add typed GREEN-API client"
```

---

### Task 4: Проверять инстанс до входа

**Files:**
- Modify: `src/client/Application.tsx`
- Modify: `src/client/Login.tsx`
- Modify: `src/client/Login.module.css`
- Modify: `src/client/Application.test.tsx`

**Interfaces:**
- Consumes: `createGreenApiClient(credentials).getState()`.
- Produces: вход в приложение только для `authorized`, состояния loading/error и безопасный `ClientFactory` для тестов.

- [ ] **Step 1: Переписать тест входа на реальную асинхронную семантику**

Экспортировать из `Application.tsx` тип:

```ts
export type ClientFactory = (credentials: Credentials) => GreenApiClient;
```

В тесте передавать fake factory в `<App clientFactory={clientFactory} />`. Добавить проверки:

```ts
async function submitCredentials(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText('idInstance'), '1100000001');
    await user.type(screen.getByLabelText('apiTokenInstance'), 'test-token');
    await user.click(screen.getByRole('button', {name: 'Войти'}));
}

it('opens chat only after an authorized response', async () => {
    const client = createGreenApiClientMock();
    client.getState.mockResolvedValue('authorized');
    const user = userEvent.setup();
    render(<App clientFactory={() => client} />);
    await submitCredentials(user);
    expect(await screen.findByRole('button', {name: 'Новый чат'})).toBeTruthy();
});

it.each(['notAuthorized', 'blocked', 'starting', 'futureState'])(
    'keeps login visible for state %s',
    async (state) => {
        const client = createGreenApiClientMock();
        client.getState.mockResolvedValue(state);
        const user = userEvent.setup();
        render(<App clientFactory={() => client} />);
        await submitCredentials(user);
        expect(await screen.findByRole('alert')).toBeTruthy();
        expect(screen.getByRole('button', {name: 'Войти'})).toBeTruthy();
    },
);
```

Использовать `createGreenApiClientMock` из Task 3, чтобы тесты не применяли `as any`.

- [ ] **Step 2: Убедиться, что тесты падают**

Run:

```bash
pnpm vitest run src/client/Application.test.tsx
```

Expected: FAIL, существующий `App` не принимает factory и входит без проверки.

- [ ] **Step 3: Реализовать проверку и состояния формы**

Изменить контракт `Login`:

```ts
type LoginProps = {
    credentialsActions: CredentialActions;
    clientFactory: ClientFactory;
};
```

В `handleSubmit`:

```ts
setStatus({kind: 'loading'});
try {
    const candidate = {idInstance: idInstance.trim(), apiTokenInstance};
    const state = await clientFactory(candidate).getState();
    if (state !== 'authorized') {
        setStatus({kind: 'error', message: instanceStateMessage(state)});
        return;
    }
    credentialsActions.login(candidate);
} catch (error) {
    setStatus({kind: 'error', message: toLoginErrorMessage(error)});
}
```

Кнопка получает `disabled` и текст «Проверяем…» во время запроса. Ошибка выводится с `role="alert"` и `aria-live="polite"`. Исправить пользовательский текст `GREEN-API для работы с MAX` на `GREEN-API для работы с WhatsApp`.

- [ ] **Step 4: Запустить тесты входа**

Run:

```bash
pnpm vitest run src/client/Application.test.tsx
```

Expected: PASS для development-prefill, authorized и всех ошибочных состояний.

- [ ] **Step 5: Commit**

```bash
git add src/client/Application.tsx src/client/Login.tsx src/client/Login.module.css src/client/Application.test.tsx
git commit -m "feat: validate GREEN-API instance on login"
```

---

### Task 5: Создавать и заменять единственный чат

**Files:**
- Create: `src/client/chat/types.ts`
- Create: `src/client/components/NewChatDialog.tsx`
- Create: `src/client/components/NewChatDialog.module.css`
- Create: `src/client/Chat.test.tsx`
- Modify: `src/client/Chat.tsx`
- Modify: `src/client/Chat.module.css`
- Modify: `src/client/components/ChatSidebar.tsx`
- Modify: `src/client/components/Conversation.tsx`
- Modify: `src/client/Application.tsx`

**Interfaces:**
- Consumes: `GreenApiClient.checkWhatsapp(chatId, signal)` и функции Task 2.
- Produces: `ActiveChat {chatId: string; phone: string}`, пустое состояние, диалог нового чата и замена только после успешной проверки.

- [ ] **Step 1: Добавить падающие сценарии создания чата**

В `Chat.test.tsx` проверить:

```ts
async function submitNewChat(user: ReturnType<typeof userEvent.setup>, phone: string) {
    await user.click(screen.getByRole('button', {name: 'Новый чат'}));
    await user.clear(screen.getByLabelText('Номер телефона'));
    await user.type(screen.getByLabelText('Номер телефона'), phone);
    await user.click(screen.getByRole('button', {name: 'Создать чат'}));
}

it('creates a chat using the chatId returned by GREEN-API', async () => {
    const user = userEvent.setup();
    client.checkWhatsapp.mockResolvedValue({
        existsWhatsapp: true,
        chatId: '123456789012345@lid',
    });
    render(<Chat client={client} />);
    await submitNewChat(user, '+7 (999) 123-45-67');
    expect(await screen.findByText('+79991234567')).toBeTruthy();
    expect(client.checkWhatsapp).toHaveBeenCalledWith('79991234567@c.us', expect.any(AbortSignal));
});

it('does not replace the current chat when the next number is invalid', async () => {
    const user = userEvent.setup();
    client.checkWhatsapp
        .mockResolvedValueOnce({existsWhatsapp: true, chatId: '79991234567@c.us'})
        .mockResolvedValueOnce({existsWhatsapp: false, chatId: null});
    render(<Chat client={client} />);
    await submitNewChat(user, '79991234567');
    await submitNewChat(user, '79997654321');
    expect(await screen.findByRole('alert')).toHaveTextContent('WhatsApp');
    expect(screen.getByText('+79991234567')).toBeTruthy();
});
```

Добавить тест локально невалидного номера без API-вызова:

```ts
it('rejects an invalid phone without calling GREEN-API', async () => {
    const user = userEvent.setup();
    render(<Chat client={client} />);
    await submitNewChat(user, '123');
    expect(await screen.findByRole('alert')).toHaveTextContent('11–16 цифр');
    expect(client.checkWhatsapp).not.toHaveBeenCalled();
});
```

Добавить защиту от stale response. Тест запускает первую проверку, закрывает и повторно открывает форму, затем завершает запросы в обратном порядке:

```ts
it('ignores a stale phone-check response', async () => {
    const user = userEvent.setup();
    let resolveFirst!: (value: CheckedWhatsapp) => void;
    const first = new Promise<CheckedWhatsapp>((resolve) => { resolveFirst = resolve; });
    client.checkWhatsapp
        .mockReturnValueOnce(first)
        .mockResolvedValueOnce({existsWhatsapp: true, chatId: '79997654321@c.us'});
    render(<Chat client={client} />);

    void submitNewChat(user, '79991234567');
    await user.click(await screen.findByRole('button', {name: 'Закрыть'}));
    await submitNewChat(user, '79997654321');
    resolveFirst({existsWhatsapp: true, chatId: '79991234567@c.us'});

    expect(await screen.findByText('+79997654321')).toBeTruthy();
    expect(screen.queryByText('+79991234567')).toBeNull();
});
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run:

```bash
pnpm vitest run src/client/Chat.test.tsx
```

Expected: FAIL, форма нового чата и реальные состояния отсутствуют.

- [ ] **Step 3: Ввести типы чата и реализовать диалог**

```ts
export type ActiveChat = {
    chatId: string;
    phone: string;
};

export type ChatMessage = {
    id: string;
    text: string;
    timestamp: number;
    direction: 'incoming' | 'outgoing';
};
```

`NewChatDialog` принимает:

```ts
type NewChatDialogProps = {
    open: boolean;
    pending: boolean;
    error: string | null;
    onClose(): void;
    onSubmit(value: string): Promise<void>;
};
```

Использовать нативный `<dialog>` либо доступный эквивалент с `role="dialog"`, `aria-modal="true"`, заголовком, `label`, обработкой Escape и возвратом фокуса на кнопку «Новый чат».

- [ ] **Step 4: Заменить mock-данные управляемым состоянием**

`Chat` принимает `client: GreenApiClient`. До создания чата показывает пустое состояние. При submit:

```ts
const phone = normalizePhone(value);
const requestedChatId = toPersonalChatId(phone);
const requestId = ++latestCheckRef.current;
const checked = await client.checkWhatsapp(requestedChatId, controller.signal);
if (requestId !== latestCheckRef.current) return;
if (!checked.existsWhatsapp || !checked.chatId) {
    throw new Error('На этом номере не найден аккаунт WhatsApp');
}
setActiveChat({chatId: checked.chatId, phone: `+${phone}`});
```

При успешной замене очистить сообщения старого чата. При ошибке оставить старое состояние без изменений.

- [ ] **Step 5: Запустить тесты чата**

Run:

```bash
pnpm vitest run src/client/Chat.test.tsx
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/client/chat src/client/components/NewChatDialog.tsx src/client/components/NewChatDialog.module.css src/client/Chat.tsx src/client/Chat.module.css src/client/components/ChatSidebar.tsx src/client/components/Conversation.tsx src/client/Application.tsx src/client/Chat.test.tsx
git commit -m "feat: create and replace active WhatsApp chat"
```

---

### Task 6: Отправлять текстовые сообщения

**Files:**
- Create: `src/client/chat/useChatSession.ts`
- Create: `src/client/chat/useChatSession.test.tsx`
- Modify: `src/client/Chat.tsx`
- Modify: `src/client/components/Conversation.tsx`
- Modify: `src/client/components/Conversation.module.css`

**Interfaces:**
- Consumes: `GreenApiClient.sendMessage`, `ActiveChat`.
- Produces: `messages`, `draft`, `setDraft`, `send`, `sending`, `sendError`, `appendIncoming`.

- [ ] **Step 1: Написать падающие тесты hook отправки**

Использовать `renderHook`:

```ts
it('adds a message only after SendMessage succeeds', async () => {
    const deferred = createDeferred<{idMessage: string}>();
    client.sendMessage.mockReturnValue(deferred.promise);
    const {result} = renderHook(() => useChatSession(client, activeChat));

    act(() => result.current.setDraft('Привет'));
    act(() => void result.current.send());
    expect(result.current.messages).toEqual([]);
    expect(result.current.sending).toBe(true);

    await act(async () => deferred.resolve({idMessage: 'out-1'}));
    expect(result.current.messages[0]).toMatchObject({id: 'out-1', text: 'Привет', direction: 'outgoing'});
    expect(result.current.draft).toBe('');
});

it('keeps the draft when sending fails', async () => {
    client.sendMessage.mockRejectedValue(new GreenApiError('Ошибка отправки', 'api', 500));
    const {result} = renderHook(() => useChatSession(client, activeChat));
    act(() => result.current.setDraft('Повторить'));
    await act(async () => result.current.send());
    expect(result.current.draft).toBe('Повторить');
    expect(result.current.sendError).toBe('Не удалось отправить сообщение');
});
```

Добавить точные проверки границ и повторной отправки:

```ts
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

it('ignores a second send while the first request is pending', async () => {
    const pending = new Promise<{idMessage: string}>(() => {});
    client.sendMessage.mockReturnValue(pending);
    const {result} = renderHook(() => useChatSession(client, activeChat));
    act(() => result.current.setDraft('Один раз'));
    act(() => {
        void result.current.send();
        void result.current.send();
    });
    expect(client.sendMessage).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run:

```bash
pnpm vitest run src/client/chat/useChatSession.test.tsx
```

Expected: FAIL, hook отсутствует.

- [ ] **Step 3: Реализовать hook и управляемую форму**

Публичный результат hook:

```ts
export type ChatSession = {
    messages: ChatMessage[];
    draft: string;
    setDraft(value: string): void;
    send(): Promise<void>;
    sending: boolean;
    sendError: string | null;
    appendIncoming(message: ChatMessage): void;
};
```

`send()` обрезает пробелы только для проверки пустоты, но отправляет исходный текст; блокирует повторный вызов, валидирует лимит 20 000, ждёт API, добавляет сообщение с `Date.now()` и очищает draft только после успеха.

`Conversation` получает значения hook через props. Кнопка имеет `type="submit"`, форма обрабатывает `onSubmit`, поле имеет `maxLength={20_000}` и блокируется только на время отправки. Ошибка выводится через `role="alert"`.

- [ ] **Step 4: Запустить тесты отправки и компонента**

Run:

```bash
pnpm vitest run src/client/chat/useChatSession.test.tsx src/client/Chat.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/client/chat/useChatSession.ts src/client/chat/useChatSession.test.tsx src/client/Chat.tsx src/client/components/Conversation.tsx src/client/components/Conversation.module.css
git commit -m "feat: send WhatsApp text messages"
```

---

### Task 7: Разбирать входящие текстовые уведомления

**Files:**
- Create: `src/client/chat/parseNotification.ts`
- Create: `src/client/chat/parseNotification.test.ts`

**Interfaces:**
- Consumes: `NotificationEnvelope`, активный `chatId`.
- Produces: `parseIncomingText(envelope, activeChatId): ChatMessage | null`.

- [ ] **Step 1: Написать таблицу падающих тестов форматов**

Проверить:

```ts
it.each([
    ['textMessage', {textMessageData: {textMessage: 'Привет'}}, 'Привет'],
    ['extendedTextMessage', {extendedTextMessageData: {text: 'https://example.com'}}, 'https://example.com'],
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
```

Зафиксировать игнорируемые и повреждённые события:

```ts
it.each([
    ['another chat', notification({
        typeWebhook: 'incomingMessageReceived',
        idMessage: '1',
        timestamp: 1,
        senderData: {chatId: 'another@c.us'},
        messageData: {typeMessage: 'textMessage', textMessageData: {textMessage: 'x'}},
    })],
    ['another webhook', notification({typeWebhook: 'outgoingMessageStatus'})],
    ['media', notification({
        typeWebhook: 'incomingMessageReceived',
        idMessage: '2',
        timestamp: 1,
        senderData: {chatId: activeChatId},
        messageData: {typeMessage: 'imageMessage'},
    })],
    ['quoted message', notification({
        typeWebhook: 'incomingMessageReceived',
        idMessage: '3',
        timestamp: 1,
        senderData: {chatId: activeChatId},
        messageData: {typeMessage: 'quotedMessage'},
    })],
    ['missing fields', {receiptId: 4, body: {}}],
    ['non-object body', {receiptId: 5, body: 'broken'}],
] as const)('returns null for %s', (_name, envelope) => {
    expect(parseIncomingText(envelope, activeChatId)).toBeNull();
});
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run:

```bash
pnpm vitest run src/client/chat/parseNotification.test.ts
```

Expected: FAIL, parser отсутствует.

- [ ] **Step 3: Реализовать runtime-проверку unknown-ответа**

Использовать узкие guards вместо `any`:

```ts
function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

export function parseIncomingText(
    envelope: NotificationEnvelope,
    activeChatId: string,
): ChatMessage | null {
    const body = envelope.body;
    if (!isRecord(body) || body.typeWebhook !== 'incomingMessageReceived') return null;
    if (!isRecord(body.senderData) || body.senderData.chatId !== activeChatId) return null;
    if (!isRecord(body.messageData) || typeof body.idMessage !== 'string') return null;

    let text: string | null = null;
    if (body.messageData.typeMessage === 'textMessage') {
        const data = body.messageData.textMessageData;
        if (isRecord(data) && typeof data.textMessage === 'string') text = data.textMessage;
    }
    if (body.messageData.typeMessage === 'extendedTextMessage') {
        const data = body.messageData.extendedTextMessageData;
        if (isRecord(data) && typeof data.text === 'string') text = data.text;
    }
    if (text === null || typeof body.timestamp !== 'number') return null;

    return {
        id: body.idMessage,
        text,
        timestamp: body.timestamp * 1000,
        direction: 'incoming',
    };
}
```

Финальная реализация обязана возвращать `null` для любой неизвестной формы и не приводить `unknown` через `as` без проверки.

- [ ] **Step 4: Запустить тесты parser**

Run:

```bash
pnpm vitest run src/client/chat/parseNotification.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/client/chat/parseNotification.ts src/client/chat/parseNotification.test.ts
git commit -m "feat: parse incoming GREEN-API text notifications"
```

---

### Task 8: Добавить последовательный polling, дедупликацию и backoff

**Files:**
- Create: `src/client/chat/useNotificationPolling.ts`
- Create: `src/client/chat/useNotificationPolling.test.tsx`
- Modify: `src/client/chat/useChatSession.ts`
- Modify: `src/client/chat/useChatSession.test.tsx`
- Modify: `src/client/Chat.tsx`
- Modify: `src/client/components/Conversation.tsx`

**Interfaces:**
- Consumes: `receiveNotification`, `deleteNotification`, `parseIncomingText`, `chatId`, `AbortSignal`.
- Produces: единственный polling-цикл, `receiveError`, сообщения без дублей и cleanup.

- [ ] **Step 1: Написать падающий happy-path тест порядка вызовов**

```ts
it('receives, appends, deletes, then requests the next notification', async () => {
    const calls: string[] = [];
    client.receiveNotification
        .mockImplementationOnce(async () => {
            calls.push('receive-1');
            return textNotification('message-1', chatId);
        })
        .mockImplementationOnce(() => new Promise(() => {}));
    client.deleteNotification.mockImplementation(async () => {
        calls.push('delete-1');
    });

    renderHook(() => useNotificationPolling({client, chatId, onMessage}));
    await waitFor(() => expect(onMessage).toHaveBeenCalledTimes(1));
    expect(calls).toEqual(['receive-1', 'delete-1']);
    expect(client.receiveNotification).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 2: Добавить падающие тесты отказов и lifecycle**

С fake timers проверить пустую очередь и backoff:

```ts
it('continues after null without exposing an error', async () => {
    client.receiveNotification
        .mockResolvedValueOnce(null)
        .mockImplementation(() => new Promise(() => {}));
    const {result} = renderHook(() => useNotificationPolling({client, chatId, onMessage}));
    await waitFor(() => expect(client.receiveNotification).toHaveBeenCalledTimes(2));
    expect(result.current.receiveError).toBeNull();
});

it('uses 1, 2, 5 and capped 10 second retry delays', async () => {
    vi.useFakeTimers();
    client.receiveNotification.mockRejectedValue(new GreenApiError('Сеть', 'network', null));
    renderHook(() => useNotificationPolling({client, chatId, onMessage}));
    for (const delay of [1_000, 2_000, 5_000, 10_000, 10_000]) {
        const calls = client.receiveNotification.mock.calls.length;
        await vi.advanceTimersByTimeAsync(delay - 1);
        expect(client.receiveNotification).toHaveBeenCalledTimes(calls);
        await vi.advanceTimersByTimeAsync(1);
        expect(client.receiveNotification).toHaveBeenCalledTimes(calls + 1);
    }
    vi.useRealTimers();
});
```

Проверить терминальную авторизацию, удаление и дедупликацию:

```ts
it('stops after an authentication error', async () => {
    client.receiveNotification.mockRejectedValue(new GreenApiError('Доступ', 'auth', 401));
    const {result} = renderHook(() => useNotificationPolling({client, chatId, onMessage}));
    await waitFor(() => expect(result.current.stopped).toBe(true));
    expect(client.receiveNotification).toHaveBeenCalledTimes(1);
});

it('retries deletion before receiving again and does not append twice', async () => {
    vi.useFakeTimers();
    client.receiveNotification.mockResolvedValue(textNotification('same-id', chatId));
    client.deleteNotification
        .mockRejectedValueOnce(new GreenApiError('Сеть', 'network', null))
        .mockResolvedValueOnce();
    renderHook(() => useNotificationPolling({client, chatId, onMessage}));
    await waitFor(() => expect(onMessage).toHaveBeenCalledTimes(1));
    expect(client.receiveNotification).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_000);
    await waitFor(() => expect(client.deleteNotification).toHaveBeenCalledTimes(2));
    expect(onMessage).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
});
```

Проверить lifecycle через сигналы, переданные mock-клиенту:

```ts
it('aborts the old request on chat change and on unmount', () => {
    client.receiveNotification.mockImplementation(() => new Promise(() => {}));
    const view = renderHook(
        ({currentChatId}) => useNotificationPolling({client, chatId: currentChatId, onMessage}),
        {initialProps: {currentChatId: 'first@c.us'}},
    );
    const firstSignal = client.receiveNotification.mock.calls[0]?.[0];
    view.rerender({currentChatId: 'second@c.us'});
    expect(firstSignal?.aborted).toBe(true);
    const secondSignal = client.receiveNotification.mock.calls.at(-1)?.[0];
    view.unmount();
    expect(secondSignal?.aborted).toBe(true);
});
```

Зафиксировать сброс backoff после успешной итерации:

```ts
it('resets backoff after a successful receive', async () => {
    vi.useFakeTimers();
    client.receiveNotification
        .mockResolvedValueOnce(null)
        .mockRejectedValueOnce(new GreenApiError('Сеть', 'network', null))
        .mockImplementation(() => new Promise(() => {}));
    renderHook(() => useNotificationPolling({client, chatId, onMessage}));
    await waitFor(() => expect(client.receiveNotification).toHaveBeenCalledTimes(2));
    await vi.advanceTimersByTimeAsync(999);
    expect(client.receiveNotification).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(client.receiveNotification).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
});
```

- [ ] **Step 3: Убедиться, что тесты падают**

Run:

```bash
pnpm vitest run src/client/chat/useNotificationPolling.test.tsx
```

Expected: FAIL, hook отсутствует.

- [ ] **Step 4: Реализовать отменяемый последовательный цикл**

Публичный контракт:

```ts
type NotificationPollingOptions = {
    client: GreenApiClient;
    chatId: string;
    onMessage(message: ChatMessage): void;
};

type NotificationPollingState = {
    receiveError: string | null;
    stopped: boolean;
};
```

В одном `useEffect` создать `AbortController`, `Set<string>` для показанных ID и async loop. Backoff и отменяемая задержка имеют один источник истины:

```ts
const RETRY_DELAYS = [1_000, 2_000, 5_000, 10_000] as const;

function sleep(delay: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        const timeout = window.setTimeout(finish, delay);
        signal.addEventListener('abort', abort, {once: true});
        function finish() {
            signal.removeEventListener('abort', abort);
            resolve();
        }
        function abort() {
            window.clearTimeout(timeout);
            reject(new DOMException('Aborted', 'AbortError'));
        }
    });
}

function retryDelay(attempt: number): number {
    return RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)] ?? 10_000;
}
```

Алгоритм каждой итерации:

```ts
while (!controller.signal.aborted) {
    const envelope = await client.receiveNotification(controller.signal);
    if (envelope === null) continue;

    const message = parseIncomingText(envelope, chatId);
    if (message && !seenIds.has(message.id)) {
        seenIds.add(message.id);
        onMessageRef.current(message);
    }

    await deleteWithRetry(envelope.receiptId, controller.signal);
}
```

`deleteWithRetry` остаётся внутри текущей итерации:

```ts
async function deleteWithRetry(receiptId: number, signal: AbortSignal) {
    let attempt = 0;
    while (!signal.aborted) {
        try {
            await client.deleteNotification(receiptId, signal);
            return;
        } catch (error) {
            if (isAbortError(error)) throw error;
            if (error instanceof GreenApiError && error.kind === 'auth') throw error;
            setReceiveError('Не удалось подтвердить получение сообщения. Повторяем попытку…');
            await sleep(retryDelay(attempt), signal);
            attempt += 1;
        }
    }
}
```

`isAbortError` проверяет `DOMException` с именем `AbortError`. AbortError завершает цикл без UI-ошибки. `GreenApiError.kind === 'auth'` переводит hook в `stopped: true`; остальные ошибки показывают неблокирующий текст и используют тот же backoff. Cleanup вызывает `controller.abort()`.

- [ ] **Step 5: Интегрировать polling в сессию чата**

`useChatSession` запускает `useNotificationPolling` только при наличии активного чата и передаёт `appendIncoming`. `appendIncoming` использует функциональное обновление массива. При смене `chatId` hook очищает сообщения, draft, ошибки и локальные ID старой сессии.

`Conversation` показывает временную ошибку получения отдельно от ошибки отправки; поле ввода остаётся доступным.

- [ ] **Step 6: Запустить тесты polling и сессии**

Run:

```bash
pnpm vitest run src/client/chat/useNotificationPolling.test.tsx src/client/chat/useChatSession.test.tsx src/client/Chat.test.tsx
```

Expected: PASS; незавершённых timers и unhandled promise rejections нет.

- [ ] **Step 7: Commit**

```bash
git add src/client/chat/useNotificationPolling.ts src/client/chat/useNotificationPolling.test.tsx src/client/chat/useChatSession.ts src/client/chat/useChatSession.test.tsx src/client/Chat.tsx src/client/components/Conversation.tsx
git commit -m "feat: receive WhatsApp messages with polling"
```

---

### Task 9: Завершить адаптивность, доступность и документацию

**Files:**
- Modify: `src/client/styles/tokens.css`
- Modify: `src/client/styles/base.css`
- Modify: `src/client/Chat.module.css`
- Modify: `src/client/components/ChatSidebar.module.css`
- Modify: `src/client/components/Conversation.module.css`
- Modify: `src/client/components/NewChatDialog.module.css`
- Modify: `src/client/components/ChatSidebar.tsx`
- Modify: `src/client/components/Conversation.tsx`
- Modify: `src/client/Chat.test.tsx`
- Modify: `README.md`
- Modify: `docs/frontend-only-architecture.md`

**Interfaces:**
- Consumes: завершённые сценарии Tasks 4–8 и дизайн-токены проекта.
- Produces: desktop/mobile navigation, keyboard accessibility, актуальный README и финальные проверки MVP.

- [ ] **Step 1: Добавить падающие компонентные проверки mobile navigation и a11y**

Проверить наблюдаемую структуру, не значения CSS:

```ts
it('returns from the conversation without deleting the current session', async () => {
    const user = userEvent.setup();
    client.checkWhatsapp.mockResolvedValue({existsWhatsapp: true, chatId});
    client.receiveNotification
        .mockResolvedValueOnce(textNotification('incoming-1', chatId, 'Входящее сообщение'))
        .mockImplementation(() => new Promise(() => {}));
    render(<Chat client={client} />);
    await submitNewChat(user, '79991234567');
    expect(await screen.findByText('Входящее сообщение')).toBeTruthy();
    await user.click(screen.getByRole('button', {name: 'Назад к чатам'}));
    await user.click(screen.getByRole('button', {name: /7999/}));
    expect(screen.getByText('Входящее сообщение')).toBeTruthy();
});

it('exposes async errors to assistive technologies', async () => {
    const user = userEvent.setup();
    client.checkWhatsapp.mockResolvedValue({existsWhatsapp: true, chatId});
    client.sendMessage.mockRejectedValue(new GreenApiError('Ошибка', 'api', 500));
    render(<Chat client={client} />);
    await submitNewChat(user, '79991234567');
    await user.type(screen.getByLabelText('Сообщение'), 'Не отправится');
    await user.click(screen.getByRole('button', {name: 'Отправить'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось отправить');
});
```

Также проверить доступные имена кнопок «Отправить», «Новый чат», «Назад к чатам» и наличие label у всех inputs.

- [ ] **Step 2: Убедиться, что новые проверки падают**

Run:

```bash
pnpm vitest run src/client/Chat.test.tsx
```

Expected: FAIL до добавления мобильной навигации и необходимых accessible names.

- [ ] **Step 3: Реализовать mobile/desktop layout**

Использовать единый breakpoint-токен по смыслу `768px`; CSS custom properties нельзя применять внутри media query, поэтому значение breakpoint повторяется только в media queries, а размеры и цвета остаются токенами.

Desktop (`min-width: 768px`): sidebar и conversation отображаются одновременно. Mobile (`max-width: 767px`): `Chat` переключает классы `listView`/`conversationView`, показывает один экран, а в header переписки выводит кнопку «Назад к чатам».

На ширине `320px`:

- `min-width: 0` установлен для grid/flex children;
- длинные сообщения переносятся через `overflow-wrap: anywhere`;
- input и кнопки не создают горизонтальный overflow;
- composer учитывает safe-area через `env(safe-area-inset-bottom, 0px)`.

- [ ] **Step 4: Завершить focus/loading/error states**

Добавить `:focus-visible`, `:disabled`, loading-тексты и `aria-live`. При открытии диалога фокус переходит в поле номера; при закрытии возвращается на кнопку «Новый чат». Декоративные символы имеют `aria-hidden="true"`.

- [ ] **Step 5: Обновить документацию запуска и ограничений**

В `README.md`:

- переименовать вводное описание с MAX на WhatsApp, сохранив упоминание MAX только как визуального прототипа;
- добавить `pnpm install`, `pnpm dev`, `pnpm check`;
- описать настройку `incomingWebhook` и пустого `webhookUrl`;
- сослаться на `docs/mvp-requirements.md` и `docs/frontend-only-architecture.md`;
- зафиксировать session-only историю и один активный чат.

В архитектурном документе синхронизировать обязательную поддержку `extendedTextMessage`, предварительные проверки и точный breakpoint.

- [ ] **Step 6: Выполнить полную автоматическую проверку**

Run:

```bash
pnpm run check
git diff --check
```

Expected: TypeScript, все тесты и production build PASS; `git diff --check` не выводит ошибок.

- [ ] **Step 7: Проверить отсутствие секретов и серверного кода**

Run:

```bash
test ! -d src/server
test ! -f dist/.env.development.local
rg -n "apiTokenInstance|VITE_GREEN_API" dist/assets
git status --short
```

Expected: `src/server` отсутствует; `.env.development.local` не копируется; поиск production bundle не содержит реального токена или значений из локального env. Само имя поля может встретиться и проверяется вручную. В `git status` присутствуют только намеренные файлы.

- [ ] **Step 8: Выполнить ручную приёмку**

С реальным тестовым инстансом пройти AC-01–AC-09 из `docs/mvp-requirements.md`:

1. Вход с authorized и ошибочным инстансом.
2. Проверка существующего и отсутствующего номера.
3. Отправка и получение обычного текста и текста со ссылкой.
4. Замена чата без замены при ошибке проверки.
5. Перезагрузка и подтверждение очистки сессии.
6. Desktop viewport `1440×900`.
7. Mobile viewports `390×844` и `320×568`.
8. Полный основной сценарий только клавиатурой.

Expected: все критерии выполняются; внешние CORS/API-ограничения, если обнаружены, документированы с точным воспроизведением.

- [ ] **Step 9: Commit**

```bash
git add README.md docs src/client
git commit -m "feat: complete responsive WhatsApp chat MVP"
```

---

## Итоговая проверка покрытия ТЗ

- Вход и `GetStateInstance`: Task 4.
- Проверка номера и замена одного чата: Tasks 2 и 5.
- `SendMessage`: Tasks 3 и 6.
- `ReceiveNotification`/`DeleteNotification`: Tasks 3, 7 и 8.
- Дедупликация, backoff и lifecycle: Task 8.
- Desktop/mobile UX и доступность: Tasks 5 и 9.
- Хранение только в памяти и безопасность ошибок: Tasks 3, 4, 6 и 9.
- Автоматическая и ручная приёмка: все задачи, финально Task 9.
- Исключение backend: Task 1.
