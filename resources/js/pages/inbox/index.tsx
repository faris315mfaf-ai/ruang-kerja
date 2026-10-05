import { Head } from '@inertiajs/react';
import { InboxAppBarActions } from '@/features/notifications/inbox-app-bar-actions';
import { InboxDesktop } from '@/features/notifications/inbox.desktop';
import { InboxMobile } from '@/features/notifications/inbox.mobile';
import { useInbox } from '@/features/notifications/use-inbox';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import type {
    InboxCounts,
    InboxFilters,
    InboxKind,
    InboxNotification,
} from '@/types/notifications';

type Props = {
    items: { data: InboxNotification[] };
    counts: InboxCounts;
    filters: InboxFilters;
    kinds: InboxKind[];
    retentionDays: number;
};

/** Inbox (Sprint 8): every notification + "Perlu tindakan". */
export default function InboxPage({
    items,
    counts,
    filters,
    kinds,
    retentionDays,
}: Props) {
    const breakpoint = useBreakpoint();
    const inbox = useInbox({ items: items.data, counts, filters });

    return (
        <>
            <Head
                title={counts.unread > 0 ? `(${counts.unread}) Inbox` : 'Inbox'}
            />
            {breakpoint === 'mobile' ? (
                <InboxMobile
                    inbox={inbox}
                    kinds={kinds}
                    retentionDays={retentionDays}
                />
            ) : (
                <InboxDesktop
                    inbox={inbox}
                    kinds={kinds}
                    retentionDays={retentionDays}
                />
            )}
        </>
    );
}

InboxPage.layout = {
    breadcrumbs: [{ title: 'Inbox', href: '/inbox' }],
    appBarActions: <InboxAppBarActions />,
};
