import { Link, router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { useUnreadCount } from '@/features/notifications/unread-store';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { useKeyboardOpen } from '@/hooks/use-keyboard-open';
import { activeTabIndex, tabNavItems } from '@/lib/navigation';
import { cn } from '@/lib/utils';

/**
 * Bottom tab bar as a floating "dock capsule": Beranda · Absen · Tugas · Inbox ·
 * Menu. Glass, inset from the screen edges and lifted above the safe area,
 * hidden while the keyboard is open (docs/PLATFORM.md §2 & §4).
 *
 * The active tab sits on a pill that slides between tabs (transform only,
 * 180ms ease-brand; instant with prefers-reduced-motion). It moves on tap,
 * before the next page arrives, so the bar answers immediately; icons shrink
 * slightly on press for touch-down feedback.
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
            className="fixed inset-x-(--screen-gutter) bottom-[calc(env(safe-area-inset-bottom)+var(--screen-gutter))] z-40 mx-auto max-w-[420px]"
        >
            <ul className="glass relative grid h-(--tab-bar-capsule) grid-cols-5 rounded-full p-1 shadow-(--dock-shadow)">
                <li
                    aria-hidden
                    data-testid="tab-pill"
                    className={cn(
                        'pointer-events-none absolute inset-y-1 left-1 w-[calc((100%-8px)/5)] transition-[transform,opacity] duration-180 ease-brand motion-reduce:transition-none',
                        shown < 0 && 'opacity-0',
                    )}
                    style={{
                        transform: `translateX(${Math.max(shown, 0) * 100}%)`,
                    }}
                >
                    <span className="block size-full rounded-full bg-primary/12 dark:bg-primary/16" />
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
                                    'group flex h-full min-h-11 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-medium transition-colors duration-120 ease-brand select-none [-webkit-touch-callout:none] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset',
                                    highlighted
                                        ? 'text-primary'
                                        : 'text-text-muted',
                                )}
                            >
                                <span className="relative transition-transform duration-120 ease-brand group-active:scale-90 motion-reduce:transition-none">
                                    <item.icon
                                        className="size-6"
                                        strokeWidth={highlighted ? 2 : 1.75}
                                        aria-hidden
                                    />
                                    {badge > 0 && (
                                        <span className="absolute -top-1.5 -right-2.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none font-semibold text-primary-foreground tnum ring-2 ring-background">
                                            {badge > 99 ? '99+' : badge}
                                        </span>
                                    )}
                                </span>
                                <span className="max-w-full truncate px-0.5">
                                    {item.title}
                                </span>
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
