import { Head, Link } from '@inertiajs/react';
import {
    AlertTriangle,
    ChevronRight,
    ClipboardList,
    Users,
} from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Panel } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { DailyReportCard } from '@/features/reports/daily-report-card';
import { STATUS_TONES, hoursText, statusText } from '@/features/reports/lib';
import type {
    ReportFeed,
    ReportHistoryRow,
    ReportPerson,
    TodayReportStatus,
} from '@/features/reports/types';
import { formatLongDate } from '@/lib/format';
import { cn, focusRing } from '@/lib/utils';

type Props = {
    owner: ReportPerson;
    mine: boolean;
    today: TodayReportStatus | null;
    reports: ReportHistoryRow[];
    /** Deferred; null when I read nobody else's reports. */
    team?: ReportFeed | null;
};

function HistoryRow({
    row,
    ownerId,
}: {
    row: ReportHistoryRow;
    ownerId: string;
}) {
    const meta = [`${row.items_count} pekerjaan`, hoursText(row.hours)].filter(
        Boolean,
    );

    return (
        <Link
            href={`/laporan/${ownerId}/${row.date}`}
            prefetch
            className={cn(
                'flex min-h-[72px] items-center gap-3 px-5 py-3 transition-colors duration-120 ease-brand hover:bg-surface-2/60 md:px-6',
                focusRing,
                'focus-visible:ring-inset',
            )}
        >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="flex flex-wrap items-center gap-2 text-[17px] font-semibold text-text">
                    {formatLongDate(row.date)}
                    <Badge
                        variant="status"
                        tone={STATUS_TONES[row.status]}
                        dot
                        className="h-7 px-2.5 text-[14px]"
                    >
                        {statusText(row.status, row.submitted_at)}
                    </Badge>
                    {row.has_blockers && (
                        <span className="inline-flex items-center gap-1 text-meta font-semibold text-warning">
                            <AlertTriangle className="size-4" aria-hidden />
                            Ada hambatan
                        </span>
                    )}
                </p>
                {row.summary && (
                    <p className="line-clamp-2 text-[15px] text-text-muted">
                        {row.summary}
                    </p>
                )}
                <p className="text-meta text-text-muted">{meta.join(' · ')}</p>
            </div>
            <ChevronRight
                className="size-5 shrink-0 text-text-subtle"
                aria-hidden
            />
        </Link>
    );
}

function TeamSection({ team }: { team: ReportFeed | null | undefined }) {
    if (team === null) {
        return null;
    }

    if (team === undefined) {
        return (
            <Panel title="Laporan tim hari ini">
                <div className="flex flex-col gap-2 pb-1" aria-busy="true">
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                </div>
            </Panel>
        );
    }

    return (
        <Panel
            title="Laporan tim hari ini"
            action={
                <span className="text-meta text-text-muted tnum">
                    {team.counts.submitted}/{team.counts.total} terkirim
                </span>
            }
            flush
        >
            {team.people.length === 0 ? (
                <div className="px-5 pb-1 md:px-6">
                    <EmptyState
                        size="sm"
                        icon={Users}
                        title="Belum ada anggota tim"
                    />
                </div>
            ) : (
                <ul className="divide-y divide-divider border-t border-divider">
                    {team.people.map(({ user, status, report }) => (
                        <li key={user.id}>
                            <Link
                                href={
                                    report
                                        ? `/laporan/${user.id}/${team.date}`
                                        : `/laporan/${user.id}`
                                }
                                className={cn(
                                    'flex min-h-16 items-center gap-3 px-5 py-2.5 hover:bg-surface-2/60 md:px-6',
                                    focusRing,
                                    'focus-visible:ring-inset',
                                )}
                            >
                                <UserAvatar
                                    name={user.name}
                                    src={user.avatar}
                                    className="size-10"
                                />
                                <span className="flex min-w-0 flex-1 flex-col">
                                    <span className="truncate text-[16px] font-semibold text-text">
                                        {user.name}
                                    </span>
                                    <span className="truncate text-meta text-text-muted">
                                        {report?.summary ??
                                            [user.position, user.division]
                                                .filter(Boolean)
                                                .join(' · ')}
                                    </span>
                                </span>
                                <Badge
                                    variant="status"
                                    tone={STATUS_TONES[status]}
                                    dot
                                    className="h-7 shrink-0 px-2.5 text-[14px]"
                                >
                                    {status === 'draft'
                                        ? 'Belum dikirim'
                                        : statusText(
                                              status,
                                              report?.submitted_at ?? null,
                                          )}
                                </Badge>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </Panel>
    );
}

/**
 * /laporan: my daily reports (today's card + history) and, for readers, the
 * team of today; /laporan/{user}: the sent reports of a colleague I read.
 */
export default function ReportsIndex({
    owner,
    mine,
    today,
    reports,
    team,
}: Props) {
    return (
        <>
            <Head title={mine ? 'Laporan harian' : `Laporan ${owner.name}`} />
            <div className="flex flex-col gap-5 md:gap-6">
                <header className="flex flex-wrap items-center gap-3">
                    {!mine && (
                        <UserAvatar
                            name={owner.name}
                            src={owner.avatar}
                            className="size-12"
                        />
                    )}
                    <div className="flex min-w-0 flex-col gap-1">
                        <h1 className="text-display text-text max-md:sr-only">
                            {mine ? 'Laporan harian' : owner.name}
                        </h1>
                        <p className="text-body text-text-muted md:text-body-lg">
                            {mine
                                ? 'Progres kerja harian Anda, dibaca atasan langsung.'
                                : [owner.position, owner.division]
                                      .filter(Boolean)
                                      .join(' · ') || 'Laporan progres harian'}
                        </p>
                    </div>
                </header>

                <div className="flex flex-wrap items-start gap-5">
                    <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-5">
                        {mine && today && (
                            <DailyReportCard status={today} prominent />
                        )}

                        <Panel
                            title={
                                mine ? 'Riwayat laporan' : 'Laporan terkirim'
                            }
                            flush
                        >
                            {reports.length === 0 ? (
                                <div className="px-5 pb-1 md:px-6">
                                    <EmptyState
                                        size="sm"
                                        icon={ClipboardList}
                                        title="Belum ada laporan"
                                        description={
                                            mine
                                                ? 'Laporan yang Anda tulis tampil di sini per tanggal.'
                                                : 'Belum ada laporan yang dikirim.'
                                        }
                                    />
                                </div>
                            ) : (
                                <ul className="divide-y divide-divider border-t border-divider">
                                    {reports.map((row) => (
                                        <li key={row.id}>
                                            <HistoryRow
                                                row={row}
                                                ownerId={owner.id}
                                            />
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Panel>
                    </div>

                    {mine && team !== null && (
                        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-5">
                            <TeamSection team={team} />
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

ReportsIndex.layout = (props: Props) => ({
    breadcrumbs: [{ title: 'Laporan', href: '/laporan' }],
    title: props.mine ? 'Laporan harian' : `Laporan ${props.owner.name}`,
    back: props.mine ? '/menu' : '/laporan',
});
