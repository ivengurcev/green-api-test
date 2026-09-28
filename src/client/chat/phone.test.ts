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
