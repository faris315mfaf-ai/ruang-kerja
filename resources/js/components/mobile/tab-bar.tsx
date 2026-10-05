import { Link, router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { useUnreadCount } from '@/features/notifications/unread-store';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { useKeyboardOpen } from '@/hooks/use-keyboard-open';
import { activeTabIndex, tabNavItems } from '@/lib/navigation';
import { cn } from '@/lib/utils';

/**
 * Bottom tab bar as a floating capsule (TabBar.dc.html): Beranda · Absen ·
 * Tugas · Inbox · Menu. Glass, 12px from the sides, 14px above the safe
 * area, 70px tall; hidden while the keyboard is open (docs/PLATFORM.md §4).
 *
 * The active tab sits on a gradient pill (aksi; brighter with dark ink at
 * night) that slides between tabs (transform only, 180ms ease-brand; instant
 * with prefers-reduced-motion). It moves on tap, before the next page
 * arrives, so the bar answers immediately; icons shrink slightly on press.
 */
export function TabBar() {
    const { currentUrl } = useCurrentUrl();
    const keyboardOpen = useKeyboardOpen();
    const unread = useUnreadCount();
    // Tab tapped while its page is still loading; dropped once the visit ends.
    const [pending, setPending] = useState<number | null>(null);

    useEffect(() => router.on('finish', () => setPending(null)), []);

    if (keyboardOpen) {
        return null;
    }

    const current = activeTabIndex(currentUrl);
    const shown = pending ?? current;

    return (
        <nav
            aria-label="Navigasi utama"
            data-tab-bar
            className="fixed inset-x-(--tab-bar-inset) bottom-[calc(env(safe-area-inset-bottom)+var(--tab-bar-lift))] z-40 mx-auto max-w-[420px]"
        >
            <ul className="tab-bar-surface relative grid h-(--tab-bar-capsule) grid-cols-5 rounded-full p-1.5">
                <li
                    aria-hidden
                    data-testid="tab-pill"
                    className={cn(
                        'pointer-events-none absolute inset-y-1.5 left-1.5 w-[calc((100%-12px)/5)] transition-[transform,opacity] duration-180 ease-brand motion-reduce:transition-none',
                        shown < 0 && 'opacity-0',
                    )}
                    style={{
                        transform: `translateX(${Math.max(shown, 0) * 100}%)`,
                    }}
                >
                    <span className="block size-full rounded-full bg-grad-active shadow-button" />
                </li>
                {tabNavItems.map((item, index) => {
                    const active = index === current;
                    const highlighted = index === shown;
                    const badge = item.href === '/inbox' ? unread : 0;

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
        </nav>
    );
}
