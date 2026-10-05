import { Link } from '@inertiajs/react';
import { ChevronRight, Info, MapPin, MessageSquare } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Panel, PanelLink } from '@/components/ui/panel';
import { formatRelative } from '@/lib/format';
import { cn, focusRing } from '@/lib/utils';
import { summary } from '@/routes/projects';
import { HEALTH_LABELS, HEALTH_TONES } from './lib';
import type { AttendanceSummary, FeedItem } from './types';
import type { PortfolioActions } from './use-portfolio';

/** "Update terbaru PIC" (DPortofolio): who, project key, when, summary. */
export function FeedPanel({
    feed,
    canSteer,
    actions,
    compact = false,
    className,
}: {
    feed: FeedItem[];
    canSteer: boolean;
    actions: PortfolioActions;
    compact?: boolean;
    className?: string;
}) {
    return (
        <Panel
            title="Update terbaru PIC"
            className={cn(compact ? 'pt-5 pb-3' : 'pb-4', className)}
        >
            {feed.length === 0 ? (
                <EmptyState
                    size="sm"
                    icon={MessageSquare}
                    title="Belum ada update"
                    description="Update mingguan PIC akan muncul di sini."
                />
            ) : (
                <ul className="flex flex-col">
                    {feed.map((item) => (
                        <li
                            key={item.id}
                            className="flex flex-col gap-1.5 border-t border-divider py-3"
                        >
                            <span className="flex flex-wrap items-center gap-2 text-label font-normal">
                                {item.author && (
                                    <UserAvatar
                                        name={item.author.name}
                                        src={item.author.avatar}
                                        className="size-7 text-[12px]"
                                    />
                                )}
                                <b className="font-bold">
                                    {item.author?.name ?? 'PIC'}
                                </b>
                                <Link
                                    href={summary.url(item.project.key)}
                                    prefetch
                                    className={cn(
                                        'rounded-xs bg-surface-2 px-1.5 py-0.5 font-mono text-[13px] font-semibold text-link hover:underline',
                                        focusRing,
                                    )}
                                >
                                    {item.project.key}
                                </Link>
                                <span
                                    className={cn(
                                        'inline-flex items-center gap-1.5 text-[14px] font-semibold',
                                        HEALTH_TONES[item.health].text,
                                    )}
                                >
                                    <span
                                        aria-hidden
                                        className={cn(
                                            'size-2 rounded-full',
                                            HEALTH_TONES[item.health].dot,
                                        )}
                                    />
                                    {HEALTH_LABELS[item.health]}
                                </span>
                                <span className="text-text-muted">
                                    {formatRelative(item.created_at)}
                                </span>
                            </span>
                            <p
                                className={cn(
                                    'text-body text-text-muted',
                                    compact && 'line-clamp-2',
                                )}
                            >
                                {item.summary}
                            </p>
                            {canSteer && !compact && (
                                <Button
                                    variant="quiet"
                                    size="sm"
                                    className="-ml-2 self-start"
                                    onClick={() =>
                                        actions.openDirection(
                                            {
                                                key: item.project.key,
                                                name: item.project.name,
                                            },
                                            item.id,
                                            item.summary,
                                        )
                                    }
                                >
                                    <MessageSquare aria-hidden />
                                    Balas
                                </Button>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </Panel>
    );
}

const HR_HREF = '/dashboard?view=hr';

/** The ONE attendance widget, linking to Dashboard HR. */
export function AttendanceWidget({
    attendance,
    compact = false,
}: {
    attendance: AttendanceSummary;
    compact?: boolean;
}) {
    const segments = [
        { key: 'present', value: attendance.present, fill: 'bg-success' },
        {
            key: 'leave',
            value: attendance.on_leave,
            fill: 'bg-accent-blue-strong',
        },
        {
            key: 'none',
            value: attendance.not_checked_in,
            fill: 'bg-border-strong',
        },
    ].filter((segment) => segment.value > 0);

    if (compact) {
        return (
            <Link
                href={HR_HREF}
                prefetch
                className={cn(
                    'flex min-h-14 items-center gap-3 rounded-card border border-border bg-surface px-4 text-[16px]',
                    focusRing,
                )}
            >
                <MapPin className="size-5 text-text-muted" aria-hidden />
                <span className="text-text-muted">
                    Hadir hari ini{' '}
                    <b className="text-text tnum">
                        {attendance.present}/{attendance.total}
                    </b>
                </span>
                {attendance.not_checked_in > 0 && (
                    <Badge variant="status" tone="warning" className="h-7">
                        {attendance.not_checked_in} belum
                    </Badge>
                )}
                <ChevronRight
                    className="ml-auto size-5 text-text-subtle"
                    aria-hidden
                />
            </Link>
        );
    }

    return (
        <section
            aria-labelledby="attendance-widget"
            className="flex flex-col gap-2 rounded-card border border-border bg-surface px-6 py-[22px] shadow-card"
        >
            <h2
                id="attendance-widget"
                className="text-[16px] font-semibold text-text-muted"
            >
                Kehadiran hari ini
            </h2>
            <p className="text-[34px] leading-10 font-bold tnum">
                {attendance.present}{' '}
                <span className="text-[18px] font-semibold text-text-muted">
                    dari {attendance.total} hadir
                </span>
            </p>
            <span
                aria-hidden
                className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-surface-2"
            >
                {segments.map((segment) => (
                    <span
                        key={segment.key}
                        className={segment.fill}
                        style={{ flexGrow: segment.value, flexBasis: 0 }}
                    />
                ))}
            </span>
            <p className="text-label font-normal text-text-muted">
                {attendance.on_leave} cuti atau izin ·{' '}
                {attendance.not_checked_in} belum check-in
            </p>
            <div className="pt-1">
                <PanelLink href={HR_HREF}>Detail di Dashboard HR</PanelLink>
            </div>
        </section>
    );
}

export function PortfolioFootnote() {
    return (
        <p className="flex items-start gap-2 text-meta text-text-muted">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            Progres = tugas selesai ÷ total tugas. Rencana = waktu berjalan ÷
            durasi proyek. Status ditetapkan PIC; penanda dari sistem.
        </p>
    );
}
