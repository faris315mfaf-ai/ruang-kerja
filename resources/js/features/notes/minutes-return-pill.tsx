import { usePage } from '@inertiajs/react';
import { ChevronRight, NotebookPen } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { cn, focusRing } from '@/lib/utils';
import { documentRoot } from './lib';
import { visitMinutes } from './minutes-navigation';
import { useMinutesSession } from './minutes-session';
import type { MinutesSession } from './minutes-session';
import type { NoteShowProps } from './types';

type PageInfo = { component: string; note?: NoteShowProps };

/**
 * Whether the page already shows the running minutes (any tab of the same
 * document): the pill is not needed there.
 */
export function isOnSessionDocument(
    page: PageInfo,
    session: MinutesSession,
): boolean {
    if (page.component !== 'notes/show' || !page.note) {
        return false;
    }

    const { notes, current } = page.note;

    return (
        (documentRoot(notes, current.id)?.id ?? current.id) === session.rootId
    );
}

/** Exit animation length (duration-180). */
const EXIT_MS = 180;

/**
 * "Kembali ke notulensi" (keputusan pemilik 6 Okt 2026): floating pill on
 * every page while note-taking mode is on, mounted once in the app shell.
 * No close button — the mode ends only with "Selesai mencatat" in the
 * editor. Desktop: above the Dock; tablet: bottom right; phone: above the
 * tab bar, clear of the FAB.
 */
export function MinutesReturnPill() {
    const page = usePage<{ note?: NoteShowProps }>();
    const { auth, features } = page.props;
    const breakpoint = useBreakpoint();
    const session = useMinutesSession(auth.user?.id);
    const shown =
        features?.notes === true &&
        session !== null &&
        !isOnSessionDocument(
            { component: page.component, note: page.props.note },
            session,
        );

    // Keep the last session on screen while the exit animation runs.
    const [rendered, setRendered] = useState<MinutesSession | null>(
        shown ? session : null,
    );
    const [closing, setClosing] = useState(false);

    useEffect(() => {
        if (shown && session) {
            setRendered(session);
            setClosing(false);

            return;
        }

        setClosing(true);
        const timer = window.setTimeout(() => {
            setRendered(null);
            setClosing(false);
        }, EXIT_MS);

        return () => window.clearTimeout(timer);
    }, [shown, session]);

    if (!rendered || breakpoint === null) {
        return null;
    }

    return (
        <div
            className={cn(
                'pointer-events-none fixed z-40 flex',
                breakpoint === 'desktop' &&
                    'inset-x-0 bottom-[calc(var(--dock-space)+6px)] justify-center px-6',
                breakpoint === 'tablet' && 'right-6 bottom-6',
                breakpoint === 'mobile' &&
                    'right-[96px] bottom-[calc(var(--tab-bar-height)+env(safe-area-inset-bottom)+12px)] left-4',
            )}
        >
            <button
                type="button"
                onClick={() => visitMinutes(rendered)}
                aria-label={`Kembali ke notulensi ${rendered.title}`}
                data-state={closing ? 'closed' : 'open'}
                className={cn(
                    'glass-strong pointer-events-auto flex h-12 max-w-[min(100%,520px)] min-w-0 items-center gap-2.5 rounded-full pr-2 pl-3 text-left text-text shadow-float transition-transform duration-120 ease-brand active:scale-[0.98]',
                    'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-2',
                    'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-bottom-2',
                    // Enter/exit 180 ms (transform + opacity); press stays 120 ms.
                    'animation-duration-180',
                    focusRing,
                )}
            >
                <span
                    aria-hidden
                    className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-grad-aksi text-on-brand"
                >
                    <NotebookPen className="size-4" />
                    <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-fill-danger ring-2 ring-surface" />
                </span>
                <span className="flex min-w-0 flex-col leading-tight">
                    <span className="text-[13px] font-semibold text-text-muted">
                        Notulensi berjalan
                    </span>
                    <span className="truncate text-[15px] font-bold">
                        {rendered.title}
                    </span>
                </span>
                <span className="ml-1 flex h-9 shrink-0 items-center gap-0.5 rounded-full bg-link-soft pr-2 pl-3 text-[14px] font-bold text-link">
                    Kembali
                    <ChevronRight aria-hidden className="size-4" />
                </span>
            </button>
        </div>
    );
}
