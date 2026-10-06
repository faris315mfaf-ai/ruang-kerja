/**
 * Indonesian mobile number input for the WhatsApp channel: accepts the ways
 * people type it (0812-3456-7890, +62 812 3456 7890, 62812…, 812…) and
 * normalizes to E.164 (+6281234567890).
 */
export type PhoneResult =
    | { ok: true; e164: string; display: string }
    | { ok: false; error: string };

/** Subscriber part after +62: starts with 8, 9–12 digits in total. */
const SUBSCRIBER = /^8\d{8,11}$/;

export function normalizePhone(input: string): PhoneResult {
    const trimmed = input.trim();

    if (trimmed === '') {
        return { ok: false, error: 'Isi nomor WhatsApp Anda.' };
    }

    if (/[^\d\s+\-().]/.test(trimmed)) {
        return { ok: false, error: 'Nomor hanya boleh berisi angka.' };
    }

    const plus = trimmed.startsWith('+');
    const digits = trimmed.replace(/\D/g, '');
    let subscriber: string;

    if (plus) {
        if (!digits.startsWith('62')) {
            return {
                ok: false,
                error: 'Hanya nomor Indonesia (+62) yang didukung.',
            };
        }

        subscriber = digits.slice(2);
    } else if (digits.startsWith('62')) {
        subscriber = digits.slice(2);
    } else if (digits.startsWith('0')) {
        subscriber = digits.slice(1);
    } else {
        subscriber = digits;
    }

    // "+62 0812…" is a common mix-up: drop the trunk zero.
    if (subscriber.startsWith('0')) {
        subscriber = subscriber.slice(1);
    }

    if (!subscriber.startsWith('8')) {
        return {
            ok: false,
            error: 'Nomor ponsel diawali 08 atau +62 8.',
        };
    }

    if (subscriber.length < 9) {
        return { ok: false, error: 'Nomor terlalu pendek.' };
    }

    if (!SUBSCRIBER.test(subscriber)) {
        return { ok: false, error: 'Nomor terlalu panjang.' };
    }

    return {
        ok: true,
        e164: `+62${subscriber}`,
        display: formatPhone(`+62${subscriber}`),
    };
}

/** "+62 812-3456-7890" from E.164 (groups of 3-4-rest). */
export function formatPhone(e164: string): string {
    const subscriber = e164.replace(/^\+62/, '');
    const head = subscriber.slice(0, 3);
    const middle = subscriber.slice(3, 7);
    const tail = subscriber.slice(7);

    return `+62 ${[head, middle, tail].filter(Boolean).join('-')}`;
}

/** "+62 812-••••-7890": shown on screens others might glance at. */
export function maskPhone(e164: string): string {
    const formatted = formatPhone(e164);
    const parts = formatted.split('-');

    if (parts.length < 3) {
        return formatted;
    }

    return [parts[0], '••••', parts.slice(2).join('-')].join('-');
}
