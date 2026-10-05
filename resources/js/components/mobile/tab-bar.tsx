import { Link } from '@inertiajs/react';
import { useUnreadCount } from '@/features/notifications/unread-store';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { useKeyboardOpen } from '@/hooks/use-keyboard-open';
import { isActivePath, tabNavItems } from '@/lib/navigation';
import { cn } from '@/lib/utils';

/**
 * Bottom tab bar: Beranda · Absen · Tugas · Inbox · Menu. Glass, respects the
 * safe area and hides while the keyboard is open (docs/PLATFORM.md §4).
 */
export function TabBar() {
    const { currentUrl } = useCurrentUrl();
    const keyboardOpen = useKeyboardOpen();
    const unread = useUnreadCount();

    if (keyboardOpen) {
        return null;
    }

    return (
        <nav
            aria-label="Navigasi utama"
            className="glass fixed inset-x-0 bottom-0 z-40 border-x-0 border-b-0 pb-safe"
        >
            <ul className="mx-auto grid h-(--tab-bar-height) max-w-xl grid-cols-5">
                {tabNavItems.map((item) => {
                    const active = isActivePath(item, currentUrl);
                    const badge = item.href === '/inbox' ? unread : 0;

                    return (
                        <li key={item.href}>
                            <Link
                                href={item.href}
                                prefetch
                                aria-current={active ? 'page' : undefined}
                                className={cn(
                                    'flex h-full min-h-11 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors duration-120 ease-brand focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset',
                                    active ? 'text-primary' : 'text-text-muted',
                                )}
                            >
                                <span className="relative">
                                    <item.icon
                                        className="size-6"
                                        strokeWidth={active ? 2 : 1.75}
                                        aria-hidden
                                    />
                                    {badge > 0 && (
                                        <span className="absolute -top-1.5 -right-2.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none font-semibold text-primary-foreground tnum ring-2 ring-background">
                                            {badge > 99 ? '99+' : badge}
                                        </span>
                                    )}
                                </span>
                                {item.title}
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
