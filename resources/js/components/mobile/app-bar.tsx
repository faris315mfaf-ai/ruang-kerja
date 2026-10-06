import { Link, router, usePage } from '@inertiajs/react';
import { Bell, ChevronLeft, Search } from 'lucide-react';
import type { ReactNode } from 'react';
import { useUnreadCount } from '@/features/notifications/unread-store';
import { useScrolled } from '@/hooks/use-scrolled';
import { cn, focusRing } from '@/lib/utils';

export type AppBarProps = {
    title?: string;
    /** Back target for child screens; shows a back button instead of actions. */
    back?: string;
    /** Replaces the default search + bell actions. */
    actions?: ReactNode;
    /** Home screen: date overline + greeting, search + bell (mobile-first Beranda). */
    variant?: 'default' | 'greeting';
};

/**
 * Round 48px icon button of the phone screens (MTugas "Cari tugas"): surface,
 * 1px border. Use for app bar actions so they line up with the defaults.
 */
export const appBarIconButton = cn(
    'relative flex size-12 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-text transition-colors duration-120 ease-brand active:bg-surface-2',
    focusRing,
);

function greeting(now: Date): string {
    const hour = Number(
        new Intl.DateTimeFormat('id-ID', {
            hour: 'numeric',
            hourCycle: 'h23',
            timeZone: 'Asia/Jakarta',
        }).format(now),
    );

    if (hour < 11) {
        return 'Selamat pagi';
    }

    if (hour < 15) {
        return 'Selamat siang';
    }

    if (hour < 19) {
        return 'Selamat sore';
    }

    return 'Selamat malam';
}

/** "Senin, 5 Oktober" (MBeranda overline). */
function overlineDate(now: Date): string {
    return new Intl.DateTimeFormat('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: 'Asia/Jakarta',
    }).format(now);
}

function SearchAction() {
    return (
        <Link href="/cari" className={appBarIconButton} aria-label="Cari">
            <Search className="size-[22px]" strokeWidth={2} aria-hidden />
        </Link>
    );
}

function DefaultActions() {
    const unread = useUnreadCount();

    return (
        <>
            <SearchAction />
            <Link
                href="/inbox"
                className={appBarIconButton}
                aria-label={
                    unread > 0
                        ? `Notifikasi, ${unread} belum dibaca`
                        : 'Notifikasi'
                }
            >
                <Bell className="size-[22px]" strokeWidth={2} aria-hidden />
                {unread > 0 && (
                    <span
                        aria-hidden
                        className="absolute top-2.5 right-2.5 size-2.5 rounded-full bg-badge ring-2 ring-surface"
                    />
                )}
            </Link>
        </>
    );
}

/**
 * Mobile screen header (MBeranda / MTugas / MSDetailTugas):
 * - tab roots: large title (32/40 extrabold) with round actions on the right
 *   (search + bell, the way into Inbox), scrolling away with the content;
 * - `greeting` (home): date overline and greeting; profile lives in Lainnya;
 * - child screens (`back`): sticky 56px bar with a round back button that
 *   turns to glass once the page scrolls.
 */
export function AppBar({
    title,
    back,
    actions,
    variant = 'default',
}: AppBarProps) {
    const scrolled = useScrolled();
    const { auth } = usePage().props;

    if (variant === 'greeting') {
        const firstName = auth.user?.name.split(' ')[0] ?? '';
        const now = new Date();

        return (
            <header className="px-4 pt-[calc(env(safe-area-inset-top)+24px)] pb-2">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                        <p className="text-overline text-link">
                            {overlineDate(now)}
                        </p>
                        <h1 className="text-display tracking-[-0.025em] break-words text-text">
                            {greeting(now)}
                            {firstName ? `, ${firstName}` : ''}
                        </h1>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        {actions ?? <DefaultActions />}
                    </div>
                </div>
            </header>
        );
    }

    if (!back) {
        return (
            <header className="px-4 pt-[calc(env(safe-area-inset-top)+24px)] pb-2">
                <div className="flex min-h-12 items-center justify-between gap-3">
                    <h1 className="min-w-0 truncate text-display tracking-[-0.025em] text-text">
                        {title}
                    </h1>
                    <div className="flex shrink-0 items-center gap-2">
                        {actions ?? <DefaultActions />}
                    </div>
                </div>
            </header>
        );
    }

    return (
        <header
            className={cn(
                'sticky top-0 z-30 border-b pt-safe transition-colors duration-180 ease-brand',
                scrolled ? 'glass border-x-0 border-t-0' : 'border-transparent',
            )}
        >
            <div className="flex h-(--app-bar-height) items-center gap-2.5 px-4">
                <button
                    type="button"
                    className={cn(appBarIconButton, 'size-11')}
                    aria-label="Kembali"
                    onClick={() =>
                        window.history.length > 1
                            ? window.history.back()
                            : router.visit(back)
                    }
                >
                    <ChevronLeft
                        className="size-[22px]"
                        strokeWidth={2.4}
                        aria-hidden
                    />
                </button>
                <h1 className="min-w-0 flex-1 truncate text-[17px] font-bold text-text">
                    {title}
                </h1>
                <div className="flex shrink-0 items-center gap-2">
                    {actions}
                </div>
            </div>
        </header>
    );
}
