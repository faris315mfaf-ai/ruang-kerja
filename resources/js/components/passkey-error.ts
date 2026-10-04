import type { PasskeyError } from '@laravel/passkeys';

/**
 * Errors raised in the browser by @laravel/passkeys carry English messages.
 * Map them to Indonesian; server-side validation messages are already
 * translated by Laravel (lang/id.json) and are passed through unchanged.
 */
const MESSAGES: Record<string, string> = {
    NotSupportedError: 'Browser ini belum mendukung passkey.',
    UserCancelledError: 'Proses passkey dibatalkan.',
    PasskeyExistsError: 'Perangkat ini sudah terdaftar sebagai passkey.',
    InvalidDomainError:
        'Passkey tidak dapat dipakai di domain ini. Untuk pengembangan lokal, gunakan localhost.',
};

const UNKNOWN_ERROR = 'An unknown error occurred.';

export function passkeyErrorMessage(
    error: string | null,
    instance: PasskeyError | null,
): string | undefined {
    if (!error) {
        return undefined;
    }

    if (instance && instance.name in MESSAGES) {
        return MESSAGES[instance.name] ?? error;
    }

    if (error === UNKNOWN_ERROR) {
        return 'Terjadi kesalahan yang tidak diketahui. Silakan coba lagi.';
    }

    return error;
}
