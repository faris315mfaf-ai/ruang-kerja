import { Link } from '@inertiajs/react';
import {
    Archive,
    ArchiveRestore,
    CalendarPlus,
    ExternalLink,
    Inbox,
    Mail,
    MailOpen,
} from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { notificationDetailRenderer } from '@/features/notifications/detail-renderers';
import { ActionBadge, ContextText } from '@/features/notifications/inbox-parts';
import {
    notificationIcon,
    toneClasses,
} from '@/features/notifications/notification-icon';
import { NotificationTitle } from '@/features/notifications/notification-title';
import type { InboxState } from '@/features/notifications/use-inbox';
import { dayGroupLabel } from '@/features/notifications/utils';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { InboxNotification } from '@/types/notifications';

type Props = {
    notification: InboxNotification | null;
    inbox: InboxState;
};

const PANEL =
    'flex min-w-0 flex-col gap-[18px] rounded-panel border border-border bg-surface p-6 shadow-float lg:p-7';

/** Design buttons of the detail panel: 48px, radius 14. */
const ACTION = 'h-12 rounded-[14px]';

function whenLabel(notification: InboxNotification): string {
    const day = dayGroupLabel(notification.created_at);
    const label =
        day === 'Hari ini' || day === 'Kemarin' ? day.toLowerCase() : day;

    return `${label} ${formatTime(notification.created_at)}`;
}

/**
 * Desktop detail panel (DInbox right card): kind label, title, subject
 * meta, the message on a soft block, the actions, then the module preview
 * (e.g. the live task card) when a module registered one.
 */
export function InboxDetail({ notification, inbox }: Props) {
    if (!notification) {
        return (
            <section aria-label="Detail notifikasi" className={PANEL}>
                <EmptyState
                    icon={Inbox}
                    size="sm"
                    title="Pilih notifikasi"
                    description="Detail notifikasi tampil di sini. Gunakan J/K untuk berpindah, E untuk mengarsipkan."
                />
            </section>
        );
    }

    const Detail = notificationDetailRenderer(notification.type);
    const KindIcon = notificationIcon(notification.icon);
    const subject = notification.subject;
    const openLabel =
        typeof notification.meta.open_label === 'string'
            ? notification.meta.open_label
            : 'Buka';
    // Secondary link (task assigned → "Rencanakan di Ruang saya"); app paths only.
    const planUrl =
        typeof notification.meta.plan_url === 'string' &&
        notification.meta.plan_url.startsWith('/') &&
        !notification.meta.plan_url.startsWith('//')
            ? notification.meta.plan_url
            : null;
    const archived = notification.archived_at !== null;
    const unread = notification.read_at === null;
    const hasSubject = Boolean(
        subject?.code || subject?.title || notification.meta.context,
    );

    return (
        <article aria-label="Detail notifikasi" className={PANEL}>
            <div className="flex flex-wrap items-center gap-2">
                <Badge
                    variant="label"
                    className={cn(
                        'font-bold',
                        toneClasses[notification.tone] ?? toneClasses.neutral,
                    )}
                >
                    <KindIcon aria-hidden strokeWidth={2} />
                    {notification.type_label || 'Notifikasi'}
                </Badge>
                {notification.action_required && <ActionBadge />}
                {archived && (
                    <Badge variant="label" tone="neutral">
                        Diarsipkan
                    </Badge>
                )}
            </div>

            <h2 className="text-h2 font-bold tracking-[-0.015em] text-text lg:text-[28px] lg:leading-9">
                <NotificationTitle notification={notification} />
            </h2>

            <div className="flex flex-col gap-2 text-[16px] text-text-muted">
                {hasSubject && (
                    <p>
                        {subject?.code && (
                            <span className="font-mono font-semibold text-text">
                                {subject.code}
                            </span>
                        )}
                        {subject?.code && subject.title && ' · '}
                        {subject?.title}
                        {notification.meta.context && (
                            <>
                                {(subject?.code || subject?.title) && ' · '}
                                <ContextText notification={notification} />
                            </>
                        )}
                    </p>
                )}
                <p className="flex items-center gap-2">
                    {notification.actor && (
                        <UserAvatar
                            name={notification.actor.name}
                            src={notification.actor.avatar}
                            className="size-6 text-[11px]"
                        />
                    )}
                    <span>
                        {[notification.actor?.name, whenLabel(notification)]
                            .filter(Boolean)
                            .join(' · ')}
                    </span>
                </p>
            </div>

            {notification.body && (
                <p className="rounded-[18px] bg-background px-5 py-[18px] text-body-lg whitespace-pre-line text-text">
                    {notification.body}
                </p>
            )}

            <div className="flex flex-wrap gap-2.5">
                {notification.url && (
                    <Button
                        className={cn(ACTION, 'px-[22px] font-bold')}
                        onClick={() => inbox.open(notification)}
                    >
                        <ExternalLink />
                        {openLabel}
                    </Button>
                )}
                {planUrl && (
                    <Button asChild variant="tonal" className={ACTION}>
                        <Link href={planUrl}>
                            <CalendarPlus />
                            {notification.meta.plan_label ?? 'Rencanakan'}
                        </Link>
                    </Button>
                )}
                <Button
                    variant="outline"
                    className={ACTION}
                    onClick={() =>
                        archived
                            ? inbox.unarchive(notification)
                            : inbox.archive(notification)
                    }
                >
                    {archived ? <ArchiveRestore /> : <Archive />}
                    {archived ? 'Kembalikan' : 'Arsipkan'}
                </Button>
                <Button
                    variant="outline"
                    className={ACTION}
                    onClick={() => inbox.toggleRead(notification)}
                >
                    {unread ? <MailOpen /> : <Mail />}
                    {unread ? 'Tandai dibaca' : 'Tandai belum dibaca'}
                </Button>
            </div>

            {Detail && (
                <div className="border-t border-divider pt-5">
                    <Detail notification={notification} />
                </div>
            )}

            <p className="text-meta text-text-subtle">
                Pintasan: J/K berpindah · E arsip · U dibaca/belum · Enter buka
            </p>
        </article>
    );
}
