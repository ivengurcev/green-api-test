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
