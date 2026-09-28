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
