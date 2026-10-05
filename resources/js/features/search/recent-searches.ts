/**
 * "Pencarian terakhir" on the mobile search screen. Per-device convenience
 * only: every read/write is guarded because storage may be unavailable.
 */
const KEY = 'rk:recent-searches';
const MAX = 5;

export function readRecentSearches(): string[] {
    try {
        const raw = window.localStorage.getItem(KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : [];

        return Array.isArray(parsed)
            ? parsed
                  .filter((item): item is string => typeof item === 'string')
                  .slice(0, MAX)
            : [];
    } catch {
        return [];
    }
}

export function rememberSearch(query: string): string[] {
    const term = query.trim();

    if (term.length < 2) {
        return readRecentSearches();
    }

    const next = [
        term,
        ...readRecentSearches().filter(
            (item) => item.toLowerCase() !== term.toLowerCase(),
        ),
    ].slice(0, MAX);

    try {
        window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
        // Storage full or blocked: the list simply isn't remembered.
    }

    return next;
}

export function clearRecentSearches(): void {
    try {
        window.localStorage.removeItem(KEY);
    } catch {
        // Ignore.
    }
}
