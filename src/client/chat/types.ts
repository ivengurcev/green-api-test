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
