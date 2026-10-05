import { lazy, Suspense, useEffect, useState } from 'react';
import {
    toggleCommandPalette,
    useCommandPaletteOpen,
} from '@/features/search/command-palette-store';

// cmdk + the palette load on first use (⌘K or a search button), not with
// every page (Sprint 10 performance).
const CommandPalette = lazy(() =>
    import('@/features/search/command-palette').then((module) => ({
        default: module.CommandPalette,
    })),
);

/**
 * Desktop & tablet: ⌘K / Ctrl+K toggles the command palette, which mounts
 * once it was opened the first time and then stays.
 */
export function CommandPaletteHost() {
    const open = useCommandPaletteOpen();
    const [used, setUsed] = useState(open);

    if (open && !used) {
        setUsed(true);
    }

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (
                event.key.toLowerCase() === 'k' &&
                (event.metaKey || event.ctrlKey)
            ) {
                event.preventDefault();
                toggleCommandPalette();
            }
        };

        window.addEventListener('keydown', onKeyDown);

        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    return used ? (
        <Suspense fallback={null}>
            <CommandPalette />
        </Suspense>
    ) : null;
}
