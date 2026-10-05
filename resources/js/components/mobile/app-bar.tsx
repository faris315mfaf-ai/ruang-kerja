import { Link, router, usePage } from '@inertiajs/react';
import { Bell, ChevronLeft, Search } from 'lucide-react';
import type { ReactNode } from 'react';
import { useUnreadCount } from '@/features/notifications/unread-store';
import { useScrolled } from '@/hooks/use-scrolled';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

export type AppBarProps = {
    title?: string;
    /** Back target for child screens; shows a back button instead of actions. */
    back?: string;
    /** Replaces the default search + bell actions. */
    actions?: ReactNode;
    /** Home screen: date + greeting in a large title (mockup MBeranda). */
    variant?: 'default' | 'greeting';
};

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

const iconButton =
    'flex size-11 items-center justify-center rounded-full text-text transition-colors duration-120 ease-brand hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

function DefaultActions() {
    const unread = useUnreadCount();

    return (
        <>
            <Link href="/cari" className={iconButton} aria-label="Cari">
                <Search className="size-5.5" strokeWidth={1.75} />
            </Link>
            <Link
                href="/inbox"
                className={cn(iconButton, 'relative')}
                aria-label={
                    unread > 0
                        ? `Notifikasi, ${unread} belum dibaca`
                        : 'Notifikasi'
                }
            >
                <Bell className="size-5.5" strokeWidth={1.75} />
                {unread > 0 && (
                    <span
                        aria-hidden
                        className="absolute top-2.5 right-2.5 size-2 rounded-full bg-primary ring-2 ring-background"
                    />
                )}
            </Link>
        </>
    );
}

/** Mobile app bar, 56px (docs/PLATFORM.md §2 & §4). */
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
            <header className="px-4 pt-[calc(env(safe-area-inset-top)+16px)] pb-2">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <p className="text-[13px] text-text-muted">
                            {formatDate(now)}
                        </p>
                        <h1 className="truncate text-[22px] leading-8 font-semibold text-text">
                            {greeting(now)}
                            {firstName ? `, ${firstName}` : ''}
                        </h1>
                    </div>
                    <div className="-mr-2 flex shrink-0 items-center">
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
            <div className="flex h-(--app-bar-height) items-center gap-1 px-2">
                {back ? (
                    <button
                        type="button"
                        className={iconButton}
                        aria-label="Kembali"
                        onClick={() =>
                            window.history.length > 1
                                ? window.history.back()
                                : router.visit(back)
                        }
                    >
                        <ChevronLeft className="size-6" strokeWidth={1.75} />
                    </button>
                ) : (
                    <span className="w-2" aria-hidden />
                )}
                <h1 className="min-w-0 flex-1 truncate text-[17px] font-semibold text-text">
                    {title}
                </h1>
                <div className="flex shrink-0 items-center">
                    {actions ?? (back ? null : <DefaultActions />)}
                </div>
            </div>
        </header>
    );
}
