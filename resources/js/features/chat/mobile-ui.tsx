import { Info, Search } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { appBarIconButton } from '@/components/mobile/app-bar';
import { cn } from '@/lib/utils';

/**
 * Tiny bridge between the phone app bar actions (rendered by the layout)
 * and the open conversation: "search" and "details" toggles.
 */
type MobileUi = { search: boolean; details: boolean };

let ui: MobileUi = { search: false, details: false };
const listeners = new Set<() => void>();

export function setMobileUi(next: Partial<MobileUi>): void {
    ui = { ...ui, ...next };
    listeners.forEach((listener) => listener());
}

export function useMobileUi(): MobileUi {
    return useSyncExternalStore(
        (listener) => {
            listeners.add(listener);

            return () => listeners.delete(listener);
        },
        () => ui,
        () => ui,
    );
}

/** App bar actions of /obrolan/{channel} on phones. */
export function ConversationAppBarActions() {
    const current = useMobileUi();

    return (
        <>
            <button
                type="button"
                className={cn(appBarIconButton, 'size-11')}
                aria-label="Cari di obrolan ini"
                aria-pressed={current.search}
                onClick={() => setMobileUi({ search: !current.search })}
            >
                <Search className="size-5" strokeWidth={2} aria-hidden />
            </button>
            <button
                type="button"
                className={cn(appBarIconButton, 'size-11')}
                aria-label="Detail obrolan"
                onClick={() => setMobileUi({ details: true })}
            >
                <Info className="size-5" strokeWidth={2} aria-hidden />
            </button>
        </>
    );
}
