import { Link, usePage } from '@inertiajs/react';
import { Bell, Search } from 'lucide-react';
import { useSyncExternalStore } from 'react';
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
import { setCommandPaletteOpen } from '@/features/search/command-palette-store';
import { TONE_CLASSES } from '@/lib/attendance';
import { shellStatus } from '@/lib/check-in-status';
import { cn, focusRing } from '@/lib/utils';
import { index as attendanceIndex } from '@/routes/attendance';
import type { BreadcrumbItem } from '@/types';

const subscribeNothing = () => () => {};

/** "⌘K" on Apple keyboards, "Ctrl K" elsewhere (MenuBar.dc.html). */
function useShortcutLabel(): string {
    return useSyncExternalStore(
        subscribeNothing,
        () => (/mac|iphone|ipad/i.test(navigator.platform) ? '⌘K' : 'Ctrl K'),
        () => 'Ctrl K',
    );
}

/** Today's attendance as a status chip: tone dot with a ring + short text. */
function AttendanceStatusChip() {
    const { attendanceStatus } = usePage().props;
    const status = shellStatus(attendanceStatus);
    const tone = TONE_CLASSES[status.tone];

    return (
        <Link
            href={attendanceIndex()}
            prefetch
            className={cn(
                'flex h-10 max-w-[300px] min-w-0 shrink items-center gap-2 rounded-full px-3.5 text-[15px] font-semibold whitespace-nowrap transition-opacity duration-120 ease-brand hover:opacity-85',
                tone.soft,
                focusRing,
            )}
            title={`${status.title} · ${status.detail}`}
        >
            <span
                aria-hidden
                className={cn(
                    'size-[9px] shrink-0 rounded-full ring-[3px] ring-current/18',
                    tone.solid,
                )}
            />
            <span className="shrink-0">{status.title}</span>
            <span className="hidden min-w-0 truncate font-medium opacity-85 xl:inline">
                · {status.detail}
            </span>
        </Link>
    );
}

/**
 * Desktop menu bar (MenuBar.dc.html): 64px glass strip with the brand,
 * breadcrumbs, today's attendance chip + check-in pill, search (⌘K),
 * notifications and the account menu. Content scrolls underneath it.
 */
export function MenuBar({ breadcrumbs }: { breadcrumbs: BreadcrumbItem[] }) {
    const { auth } = usePage().props;
    const unread = useUnreadCount();
    const shortcut = useShortcutLabel();

    return (
        <header className="glass fixed inset-x-0 top-0 z-40 flex h-(--menu-bar-height) items-center gap-4 border-x-0 border-t-0 border-b-border px-7">
            <Link
                href="/dashboard"
                prefetch
                className={cn(
                    'flex shrink-0 items-center gap-2.5 rounded-control',
                    focusRing,
                )}
                aria-label="Ke beranda"
            >
                <BrandMark size="sm" />
                <span className="text-[17px] font-bold tracking-[-0.01em] text-text">
                    RuangKerja
                </span>
            </Link>

            <span aria-hidden className="h-[22px] w-px shrink-0 bg-border" />

            <div className="min-w-0 flex-1 overflow-hidden [&_ol]:flex-nowrap [&_ol]:whitespace-nowrap">
                <Breadcrumbs breadcrumbs={breadcrumbs} />
            </div>

            <AttendanceStatusChip />
            <CheckInButton />

            <button
                type="button"
                onClick={() => setCommandPaletteOpen(true)}
                className={cn(
                    'flex h-10 w-[200px] shrink-0 items-center gap-2.5 rounded-control border border-border bg-(--field-bg) pr-3 pl-3.5 text-[15px] text-text-muted transition-colors duration-120 ease-brand hover:text-text max-xl:w-auto',
                    focusRing,
                )}
            >
                <Search className="size-[18px]" strokeWidth={2} aria-hidden />
                <span className="flex-1 text-left max-xl:sr-only">
                    Cari apa saja
                </span>
                <kbd className="rounded-[6px] border border-border px-1.5 py-0.5 font-mono text-[13px] font-semibold">
                    {shortcut}
                </kbd>
            </button>

            <Link
                href="/inbox"
                prefetch
                className={cn(
                    'relative flex size-11 shrink-0 items-center justify-center rounded-full text-text transition-colors duration-120 ease-brand hover:bg-surface-2',
                    focusRing,
                )}
                aria-label={
                    unread > 0
                        ? `Inbox, ${unread} belum dibaca`
                        : 'Inbox, tidak ada notifikasi baru'
                }
            >
                <Bell className="size-[22px]" strokeWidth={1.9} aria-hidden />
                {unread > 0 && (
                    <span
                        aria-hidden
                        className="absolute top-1.5 right-[5px] flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-badge px-[5px] text-[12px] leading-[18px] font-bold text-on-badge tnum"
                    >
                        {unread > 99 ? '99+' : unread}
                    </span>
                )}
            </Link>

            {auth.user && (
                <DropdownMenu>
                    <DropdownMenuTrigger
                        className={cn('shrink-0 rounded-full', focusRing)}
                        aria-label={`Menu akun ${auth.user.name}`}
                    >
                        <UserAvatar
                            name={auth.user.name}
                            src={auth.user.avatar}
                            ring
                            className="size-11 text-[15px]"
                        />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        align="end"
                        sideOffset={10}
                        className="w-72"
                    >
                        <UserMenuContent user={auth.user} />
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
        </header>
    );
}
