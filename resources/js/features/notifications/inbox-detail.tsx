import { Link } from '@inertiajs/react';
import {
    Archive,
    ArchiveRestore,
    ExternalLink,
    Inbox,
    Mail,
    MailOpen,
    MoreHorizontal,
    Settings2,
} from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { notificationDetailRenderer } from '@/features/notifications/detail-renderers';
import { ActionBadge, ContextText } from '@/features/notifications/inbox-parts';
import {
    NotificationIcon,
    notificationIcon,
} from '@/features/notifications/notification-icon';
import { NotificationTitle } from '@/features/notifications/notification-title';
import type { InboxState } from '@/features/notifications/use-inbox';
import { dayGroupLabel } from '@/features/notifications/utils';
import { formatTime } from '@/lib/format';
import type { InboxNotification } from '@/types/notifications';

type Props = {
    notification: InboxNotification | null;
    inbox: InboxState;
};

function whenLabel(notification: InboxNotification): string {
    const day = dayGroupLabel(notification.created_at);
    const label =
        day === 'Hari ini' || day === 'Kemarin' ? day.toLowerCase() : day;

    return `${label} ${formatTime(notification.created_at)}`;
}

/** Desktop right pane (mockup Inbox): header actions, generic payload, module preview slot. */
export function InboxDetail({ notification, inbox }: Props) {
    if (!notification) {
        return (
            <div className="flex h-full items-center justify-center p-8">
                <EmptyState
                    icon={Inbox}
                    title="Pilih notifikasi"
                    description="Detail notifikasi tampil di sini. Gunakan J/K untuk berpindah, E untuk mengarsipkan."
                    className="w-full max-w-md border-none"
                />
            </div>
        );
    }

    const Detail = notificationDetailRenderer(notification.type);
    const CategoryIcon = notificationIcon(notification.icon);
    const subject = notification.subject;
    const openLabel =
        typeof notification.meta.open_label === 'string'
            ? notification.meta.open_label
            : 'Buka';
    const archived = notification.archived_at !== null;
    const unread = notification.read_at === null;

    return (
        <article
            className="flex h-full min-h-0 flex-col"
            aria-label="Detail notifikasi"
        >
            <header className="flex min-h-14 items-center gap-3 border-b border-border px-6 py-2.5">
                <div className="flex min-w-0 flex-1 items-center gap-2 text-[13px] text-text-muted">
                    <CategoryIcon
                        aria-hidden
                        className="size-4 shrink-0"
                        strokeWidth={1.75}
                    />
                    <span className="truncate">
                        {subject?.title ?? notification.type_label}
                    </span>
                    {subject?.code && (
                        <>
                            <span aria-hidden>/</span>
                            <span className="font-mono text-text">
                                {subject.code}
                            </span>
                        </>
                    )}
                </div>
                {notification.url && (
                    <Button size="sm" onClick={() => inbox.open(notification)}>
                        <ExternalLink />
                        {openLabel}
                    </Button>
                )}
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => inbox.toggleRead(notification)}
                >
                    {unread ? <MailOpen /> : <Mail />}
                    {unread ? 'Tandai dibaca' : 'Tandai belum dibaca'}
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                        archived
                            ? inbox.unarchive(notification)
                            : inbox.archive(notification)
                    }
                >
                    {archived ? <ArchiveRestore /> : <Archive />}
                    {archived ? 'Kembalikan' : 'Arsipkan'}
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            size="icon"
                            variant="outline"
                            className="size-8"
                            aria-label="Aksi lain"
                        >
                            <MoreHorizontal />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                            <Link href="/pengaturan/notifikasi">
                                <Settings2 />
                                Atur notifikasi
                            </Link>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <div className="mx-auto max-w-3xl space-y-4">
                    <p className="flex items-center gap-2 text-xs text-text-muted">
                        {notification.actor ? (
                            <UserAvatar
                                name={notification.actor.name}
                                src={notification.actor.avatar}
                                className="size-5 text-[9px]"
                            />
                        ) : (
                            <NotificationIcon
                                icon={notification.icon}
                                tone={notification.tone}
                                className="size-5 [&>svg]:size-3"
                            />
                        )}
                        <span>
                            {[
                                notification.actor?.name,
                                whenLabel(notification),
                                notification.type_label || null,
                            ]
                                .filter(Boolean)
                                .join(' · ')}
                        </span>
                    </p>

                    <section className="rounded-lg border border-border bg-surface p-5 shadow-card">
                        <div className="flex items-start gap-3">
                            <NotificationIcon
                                icon={notification.icon}
                                tone={notification.tone}
                            />
                            <div className="min-w-0 flex-1">
                                <h2 className="text-base leading-6 font-semibold">
                                    <NotificationTitle
                                        notification={notification}
                                    />
                                </h2>
                                {(subject?.code ||
                                    subject?.title ||
                                    notification.meta.context) && (
                                    <p className="mt-0.5 text-[13px] text-text-muted">
                                        {subject?.code && (
                                            <span className="font-mono">
                                                {subject.code}
                                            </span>
                                        )}
                                        {subject?.code &&
                                            subject.title &&
                                            ' · '}
                                        {subject?.title}
                                        {notification.meta.context && (
                                            <>
                                                {(subject?.code ||
                                                    subject?.title) &&
                                                    ' · '}
                                                <ContextText
                                                    notification={notification}
                                                />
                                            </>
                                        )}
                                    </p>
                                )}
                            </div>
                            {notification.action_required && <ActionBadge />}
                        </div>
                        {notification.body && (
                            <p className="mt-4 rounded-md border border-border bg-surface-2 px-4 py-3 text-sm leading-6 whitespace-pre-line text-text">
                                {notification.body}
                            </p>
                        )}
                    </section>

                    {Detail && <Detail notification={notification} />}
                </div>
            </div>
        </article>
    );
}
