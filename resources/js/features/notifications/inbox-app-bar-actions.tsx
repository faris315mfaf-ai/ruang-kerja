import { Link, router, usePage } from '@inertiajs/react';
import { CheckCheck, Search } from 'lucide-react';
import InboxNotificationController from '@/actions/App/Http/Controllers/Notifications/InboxNotificationController';
import { appBarIconButton } from '@/components/mobile/app-bar';
import { cn } from '@/lib/utils';
import type { InboxCounts } from '@/types/notifications';

type PageProps = { counts?: InboxCounts };

/**
 * Mobile app bar actions for /inbox (MInbox "Baca semua"): search and
 * "Tandai semua dibaca" as the round 48px app bar buttons. Filters live in
 * the chip row of the page. Self-contained so it can be passed via
 * Page.layout.
 */
export function InboxAppBarActions() {
    const { counts } = usePage<PageProps>().props;
    const unread = counts?.unread ?? 0;

    return (
        <>
            <Link href="/cari" className={appBarIconButton} aria-label="Cari">
                <Search className="size-[22px]" strokeWidth={2} aria-hidden />
            </Link>
            <button
                type="button"
                className={cn(appBarIconButton, 'disabled:text-text-subtle')}
                aria-label="Tandai semua dibaca"
                disabled={unread === 0}
                onClick={() =>
                    router.visit(InboxNotificationController.readAll(), {
                        preserveScroll: true,
                        preserveState: false,
                    })
                }
            >
                <CheckCheck
                    className="size-[22px]"
                    strokeWidth={2}
                    aria-hidden
                />
            </button>
        </>
    );
}
