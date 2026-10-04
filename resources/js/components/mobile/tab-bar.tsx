import { Link } from '@inertiajs/react';
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
                                <item.icon
                                    className="size-6"
                                    strokeWidth={active ? 2 : 1.75}
                                    aria-hidden
                                />
                                {item.title}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
