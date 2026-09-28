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
