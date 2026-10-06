/** Small pure helpers for the WhatsApp and template screens. */

/** Fills provider placeholders {{1}}, {{2}}… with sample values. */
export function renderTemplate(body: string, values: string[]): string {
    return body.replace(/\{\{(\d+)\}\}/g, (match, index: string) => {
        const value = values[Number(index) - 1];

        return value === undefined ? match : value;
    });
}

/**
 * Splits WhatsApp-style *bold* markup into segments so the preview bubble
 * can render it without dangerouslySetInnerHTML.
 */
export function boldSegments(text: string): { text: string; bold: boolean }[] {
    const segments: { text: string; bold: boolean }[] = [];
    const pattern = /\*([^*\n]+)\*/g;
    let last = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
        if (match.index > last) {
            segments.push({ text: text.slice(last, match.index), bold: false });
        }

        segments.push({ text: match[1], bold: true });
        last = match.index + match[0].length;
    }

    if (last < text.length) {
        segments.push({ text: text.slice(last), bold: false });
    }

    return segments;
}

function minutes(time: string): number {
    const [h, m] = time.split(':').map(Number);

    return h * 60 + m;
}

/** Whether "HH:MM" falls in [start, end); handles ranges across midnight. */
export function isInQuietHours(
    time: string,
    start: string,
    end: string,
): boolean {
    const t = minutes(time);
    const s = minutes(start);
    const e = minutes(end);

    if (s === e) {
        return false;
    }

    return s < e ? t >= s && t < e : t >= s || t < e;
}

/** "21:00" → "21.00" (Indonesian clock). */
export function displayClock(time: string): string {
    return time.replace(':', '.');
}

/** Workspace key rule from docs/DATABASE.md (`^[A-Z][A-Z0-9]{1,9}$`). */
export function validateWorkspaceKey(
    key: string,
    taken: string[],
): string | null {
    if (key === '') {
        return 'Isi kode workspace.';
    }

    if (!/^[A-Z][A-Z0-9]{1,9}$/.test(key)) {
        return 'Kode 2–10 huruf besar/angka, diawali huruf.';
    }

    if (taken.includes(key)) {
        return 'Kode sudah dipakai workspace lain.';
    }

    return null;
}

/** "Peluncuran Produk X" → "PPX"; single word → first 3–4 letters. */
export function suggestWorkspaceKey(name: string): string {
    const words = name
        .normalize('NFD')
        .replace(/[^A-Za-z0-9 ]/g, '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (words.length === 0) {
        return '';
    }

    const key =
        words.length === 1
            ? words[0].slice(0, 4)
            : words
                  .slice(0, 4)
                  .map((word) => word[0])
                  .join('');
    const upper = key.toUpperCase();

    return /^[A-Z]/.test(upper) ? upper.slice(0, 10) : `W${upper}`.slice(0, 10);
}
