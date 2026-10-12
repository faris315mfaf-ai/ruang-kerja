import { Link, router, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useUnreadCount } from '@/features/notifications/unread-store';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { useKeyboardOpen } from '@/hooks/use-keyboard-open';
import { activeTabIndex, tabNavItems } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { centerAction, msUntilCenterFlip } from './tab-bar-center';
import { WorkspaceSheet } from './workspace-sheet';

/**
 * Bottom tab bar as a floating capsule (mobile-first canvas › TabBar):
 * Beranda · Tugas · Absen · Obrolan (Inbox when chat is off) · Lainnya.
 * Glass, 12px from the sides, 14px above the safe area, 70px tall; hidden
 * while the keyboard is open (docs/PLATFORM.md §2.1, §4).
 *
 * The raised 54px gradient button in the middle is the day's action. The
 * other active tab sits on a gradient pill (aksi; brighter with dark ink
 * at night) that slides between tabs (transform only, 180ms ease-brand;
 * instant with prefers-reduced-motion). It moves on tap, before the next
 * page arrives, so the bar answers immediately; icons shrink on press.
 */
export function TabBar() {
    const { currentUrl } = useCurrentUrl();
    const keyboardOpen = useKeyboardOpen();
    const unread = useUnreadCount();
    const { features, chatUnread, attendanceStatus } = usePage().props;
    const chat = features?.chat ?? false;

    // Re-render exactly when Absen comes back (end − 60 min): the status
    // prop does not change at that moment.
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const current = Date.now();

        // `now` is from an earlier render: catch up if the flip already passed.
        if (
            centerAction(attendanceStatus, current) !==
            centerAction(attendanceStatus, now)
        ) {
            setNow(current);

            return;
        }

        const delay = msUntilCenterFlip(attendanceStatus, current);

        if (delay === null) {
            return;
        }

        // setTimeout caps at ~24.8 days; shifts are hours away.
        const timer = window.setTimeout(
            () => setNow(Date.now()),
            Math.min(delay + 50, 2_147_000_000),
        );

        return () => window.clearTimeout(timer);
    }, [attendanceStatus, now]);

    const center = centerAction(attendanceStatus, now);

    const items = tabNavItems(chat, center);
    // Tab tapped while its page is still loading; dropped once the visit ends.
    const [pending, setPending] = useState<number | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);

    useEffect(() => router.on('finish', () => setPending(null)), []);

    if (keyboardOpen) {
        return null;
    }

    const current = activeTabIndex(currentUrl, chat, center);
    const shown = pending ?? current;
    // The centre button is its own highlight; the pill only serves side tabs.
    const pillHidden = shown < 0 || items[shown]?.center === true;

    return (
        <nav
            aria-label="Navigasi utama"
            data-tab-bar
            className="fixed inset-x-(--tab-bar-inset) bottom-[calc(env(safe-area-inset-bottom)+var(--tab-bar-lift))] z-40 mx-auto max-w-[420px]"
        >
            <ul
                className={cn(
                    'tab-bar-surface relative grid h-(--tab-bar-capsule) rounded-full p-1.5',
                    items.length === 5 ? 'grid-cols-5' : 'grid-cols-4',
                )}
            >
                <li
                    aria-hidden
                    data-testid="tab-pill"
                    className={cn(
                        'pointer-events-none absolute inset-y-1.5 left-1.5 w-[calc((100%-12px)/var(--tab-count))] transition-[transform,opacity] duration-180 ease-brand motion-reduce:transition-none',
                        pillHidden && 'opacity-0',
                    )}
                    style={
                        {
                            transform: `translateX(${Math.max(shown, 0) * 100}%)`,
                            '--tab-count': items.length,
                        } as CSSProperties
                    }
                >
                    <span className="block size-full rounded-full bg-grad-active shadow-button" />
                </li>
                {items.map((item, index) => {
                    const active = index === current;
                    const highlighted = index === shown;
                    const badge =
                        item.href === '/inbox'
                            ? unread
                            : item.href === '/obrolan'
                              ? (chatUnread ?? 0)
                              : 0;

                    if (item.center) {
                        // Workspace opens the picker sheet instead of a page.
                        if (item.sheet === 'workspace') {
                            return (
                                <li
                                    key={item.href}
                                    className="relative min-w-0"
                                >
                                    <button
                                        type="button"
                                        aria-haspopup="dialog"
                                        aria-expanded={sheetOpen}
                                        aria-current={
                                            active ? 'page' : undefined
                                        }
                                        data-tab-center
                                        onClick={() => setSheetOpen(true)}
                                        className={cn(
                                            'group flex h-full min-h-11 flex-col items-center justify-end gap-0.5 rounded-full pb-[7px] text-[12px] leading-4 outline-none select-none [-webkit-touch-callout:none] focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-inset',
                                            highlighted
                                                ? 'font-extrabold text-text'
                                                : 'font-bold text-text-muted',
                                        )}
                                    >
                                        <span className="-mt-[26px] flex size-[54px] items-center justify-center rounded-full bg-grad-active text-on-active shadow-button ring-4 ring-surface transition-transform duration-120 ease-brand group-focus-visible:ring-ring group-active:scale-90 motion-reduce:transition-none">
                                            <item.icon
                                                className="size-[26px]"
                                                strokeWidth={2.2}
                                                aria-hidden
                                            />
                                        </span>
                                        <span className="max-w-full truncate px-0.5">
                                            {item.title}
                                        </span>
                                    </button>
                                </li>
                            );
                        }

                        return (
                            <li key={item.href} className="relative min-w-0">
                                <Link
                                    href={item.href}
                                    prefetch
                                    aria-current={active ? 'page' : undefined}
                                    onClick={() => setPending(index)}
                                    data-tab-center
                                    className={cn(
                                        'group flex h-full min-h-11 flex-col items-center justify-end gap-0.5 rounded-full pb-[7px] text-[12px] leading-4 outline-none select-none [-webkit-touch-callout:none]',
                                        highlighted
                                            ? 'font-extrabold text-text'
                                            : 'font-bold text-text-muted',
                                    )}
                                >
                                    <span className="-mt-[26px] flex size-[54px] items-center justify-center rounded-full bg-grad-active text-on-active shadow-button ring-4 ring-surface transition-transform duration-120 ease-brand group-focus-visible:ring-ring group-active:scale-90 motion-reduce:transition-none">
                                        <item.icon
                                            className="size-[26px]"
                                            strokeWidth={2.2}
                                            aria-hidden
                                        />
                                    </span>
                                    <span className="max-w-full truncate px-0.5">
                                        {item.title}
                                    </span>
                                </Link>
                            </li>
                        );
                    }

                    return (
                        <li key={item.href} className="relative min-w-0">
                            <Link
                                href={item.href}
                                prefetch
                                aria-current={active ? 'page' : undefined}
                                onClick={() => setPending(index)}
                                className={cn(
                                    'group flex h-full min-h-11 flex-col items-center justify-center gap-[3px] rounded-full text-[12px] leading-4 font-bold transition-colors duration-120 ease-brand outline-none select-none [-webkit-touch-callout:none] focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-inset',
                                    highlighted
                                        ? 'text-on-active'
                                        : 'text-text-muted',
                                )}
                            >
                                <item.icon
                                    className="size-6 transition-transform duration-120 ease-brand group-active:scale-90 motion-reduce:transition-none"
                                    strokeWidth={2}
                                    aria-hidden
                                />
                                <span className="max-w-full truncate px-0.5">
                                    {item.title}
                                </span>
                                {badge > 0 && !highlighted && (
                                    <span
                                        aria-hidden
                                        className="absolute top-1 left-1/2 ml-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-badge px-1.5 text-[12px] leading-5 font-bold text-on-badge tnum"
                                    >
                                        {badge > 99 ? '99+' : badge}
                                    </span>
                                )}
                                {badge > 0 && (
                                    <span className="sr-only">
                                        , {badge} belum dibaca
                                    </span>
                                )}
                            </Link>
                        </li>
                    );
                })}
            </ul>
            <WorkspaceSheet open={sheetOpen} onOpenChange={setSheetOpen} />
        </nav>
    );
}
