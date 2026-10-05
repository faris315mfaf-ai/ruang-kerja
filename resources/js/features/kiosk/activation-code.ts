/** Characters of a kiosk pairing code (mirrors KioskActivationCode::ALPHABET). */
export const ACTIVATION_CODE_LENGTH = 8;

/**
 * Formats what is typed into the pairing-code field as "ABCD-2345": upper
 * case, letters and digits only, at most 8 characters, dash after the 4th.
 * Look-alike characters (0/O, 1/I/L) are kept so the server — not the field —
 * says the code is wrong.
 */
export function formatActivationCode(input: string): string {
    const chars = input
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, ACTIVATION_CODE_LENGTH);

    return chars.length > 4 ? `${chars.slice(0, 4)}-${chars.slice(4)}` : chars;
}

/** True when the field holds a full code (8 characters). */
export function isCompleteActivationCode(value: string): boolean {
    return value.replace(/-/g, '').length === ACTIVATION_CODE_LENGTH;
}
