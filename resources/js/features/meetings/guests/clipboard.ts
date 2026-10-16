/**
 * Copies text to the clipboard. Guest links are secrets: they are only ever
 * passed here, never logged. Falls back to a hidden textarea for browsers
 * (or insecure contexts) without the async clipboard API.
 */
export async function copyText(text: string): Promise<boolean> {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);

            return true;
        }
    } catch {
        // Fall through to the legacy path.
    }

    try {
        const area = document.createElement('textarea');

        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();

        const done = document.execCommand('copy');

        document.body.removeChild(area);

        return done;
    } catch {
        return false;
    }
}
