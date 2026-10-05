import { Link, usePage } from '@inertiajs/react';
import { Bell, Search } from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { BrandMark } from '@/components/shell/brand-mark';
import { CheckInButton } from '@/components/shell/check-in-button';
import { UserAvatar } from '@/components/shell/user-avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserMenuContent } from '@/components/user-menu-content';
import { useUnreadCount } from '@/features/notifications/unread-store';
import {
    setCommandPaletteOpen,
    toggleCommandPalette,
    useCommandPaletteOpen,
} from '@/features/search/command-palette-store';
import { TONE_CLASSES } from '@/lib/attendance';
import { shellStatus } from '@/lib/check-in-status';
import { cn } from '@/lib/utils';
import { index as attendanceIndex } from '@/routes/attendance';
import type { BreadcrumbItem } from '@/types';

// cmdk + the palette load on first use (⌘K or the search button), not with
// every page (Sprint 10 performance).
const CommandPalette = lazy(() =>
    import('@/features/search/command-palette').then((module) => ({
        default: module.CommandPalette,
    })),
);

/** Mounts the palette once it was opened the first time, then keeps it. */
function LazyCommandPalette() {
    const open = useCommandPaletteOpen();
    const [used, setUsed] = useState(open);

    if (open && !used) {
        setUsed(true);
    }

    return used ? (
        <Suspense fallback={null}>
            <CommandPalette />
        </Suspense>
    ) : null;
}

const itemClass =
    'flex h-7 items-center gap-1.5 rounded-md px-2 text-[13px] text-text-muted transition-colors duration-120 ease-brand hover:bg-text/6 hover:text-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

/** Today's attendance as a compact status item (dot · title · detail). */
function AttendanceStatusItem() {
    const { attendanceStatus } = usePage().props;
    const status = shellStatus(attendanceStatus);

    return (
        <Link
            href={attendanceIndex()}
            prefetch
            className={cn(itemClass, 'max-w-[320px] min-w-0 whitespace-nowrap')}
            title={`${status.title} · ${status.detail}`}
        >
            <span
                aria-hidden
                className={cn(
                    'size-2 shrink-0 rounded-full',
                    TONE_CLASSES[status.tone].solid,
                )}
            />
            <span className="shrink-0 font-medium text-text">
                {status.title}
            </span>
            <span className="hidden min-w-0 truncate xl:inline">
                · {status.detail}
            </span>
        </Link>
    );
}

/**
 * macOS-style menu bar: a thin translucent strip with the app identity and
 * wayfinding on the left and status items on the right (docs/PLATFORM.md §2).
 * Content scrolls underneath it.
 */
export function MenuBar({ breadcrumbs }: { breadcrumbs: BreadcrumbItem[] }) {
    const { auth } = usePage().props;
    const unread = useUnreadCount();

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

    return (
        <header className="glass fixed inset-x-0 top-0 z-40 flex h-(--menu-bar-height) items-center gap-2 border-x-0 border-t-0 px-(--screen-gutter)">
            <Link
                href="/dashboard"
                prefetch
                className="flex shrink-0 items-center rounded-md pr-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                aria-label="Ke dashboard"
            >
                <BrandMark className="[&>span:first-child]:size-6 [&>span:first-child]:rounded-[6px] [&>span:first-child]:text-[10px]" />
                <span className="ml-2 text-[13px] font-semibold tracking-[-0.01em] text-text">
                    RuangKerja
                </span>
            </Link>

            <span aria-hidden className="h-4 w-px bg-border-strong/70" />

            <div className="min-w-0 flex-1 [&_ol]:text-[13px]">
                <Breadcrumbs breadcrumbs={breadcrumbs} />
            </div>

            <AttendanceStatusItem />
            <div className="[&_a]:h-7 [&_a]:text-[12px]">
                <CheckInButton />
            </div>

            <button
                type="button"
                onClick={() => setCommandPaletteOpen(true)}
                className={cn(
                    itemClass,
                    'border border-border bg-surface/60 pr-1.5',
                )}
            >
                <Search className="size-3.5" aria-hidden />
                <span className="hidden lg:inline">Cari</span>
                <kbd className="ml-1 rounded border border-border px-1 font-mono text-[10px] text-text-subtle">
                    ⌘K
                </kbd>
            </button>

            <Link
                href="/inbox"
                prefetch
                className={cn(itemClass, 'relative px-1.5')}
                aria-label={
                    unread > 0
                        ? `Notifikasi, ${unread} belum dibaca`
                        : 'Notifikasi'
                }
            >
                <Bell className="size-4" aria-hidden />
                {unread > 0 && (
                    <span
                        aria-hidden
                        className="absolute top-1 right-1 size-1.5 rounded-full bg-primary ring-2 ring-background"
                    />
                )}
            </Link>

            {auth.user && (
                <DropdownMenu>
                    <DropdownMenuTrigger
                        className="rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        aria-label="Menu akun"
                    >
                        <UserAvatar
                            name={auth.user.name}
                            src={auth.user.avatar}
                            className="size-6 text-[10px]"
                        />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        align="end"
                        sideOffset={8}
                        className="glass w-64 rounded-xl"
                    >
                        <UserMenuContent user={auth.user} />
                    </DropdownMenuContent>
                </DropdownMenu>
            )}

            <LazyCommandPalette />
        </header>
    );
}
