import { AlertTriangle, ClipboardList, Clock } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { Progress } from '@/components/ui/progress';
import { percentOf } from '@/features/monitoring/lib';
import {
    ReportDetailSheet,
    useReportDetail,
} from '@/features/monitoring/report-detail';
import { formatTime } from '@/lib/format';
import { cn, focusRing } from '@/lib/utils';
import type { TeamReports } from './division-types';

const SHOWN = 5;

/**
 * "Laporan tim hari ini" on the Kepala Divisi dashboard (keputusan pemilik
 * 6 Okt 2026): who sent today's work progress report, who has not, and the
 * sent reports — each opens in a read-only detail sheet.
 */
export function TeamReportsPanel({
    reports,
    mobile = false,
}: {
    reports: TeamReports;
    mobile?: boolean;
}) {
    const detail = useReportDetail();
    const [all, setAll] = useState(false);
    const { totals } = reports;
    const sent = all ? reports.reports : reports.reports.slice(0, SHOWN);

    return (
        <Panel
            title={
                <>
                    Laporan tim hari ini
                    <Badge variant="status" tone="neutral" className="h-7 tnum">
                        {totals.reported}/{totals.scheduled}
                    </Badge>
                </>
            }
            className={cn(mobile && 'py-5')}
            bodyClassName="gap-4"
        >
            <div className="flex flex-col gap-2">
                <Progress
                    value={percentOf(
                        totals.reported,
                        Math.max(totals.scheduled, totals.reported),
                    )}
                    label={`${totals.reported} dari ${totals.scheduled} anggota terjadwal sudah lapor`}
                />
                <p className="text-meta text-text-muted">
                    {totals.reported} sudah lapor · {totals.draft} draf ·{' '}
                    <span
                        className={cn(
                            totals.missing > 0 && 'font-semibold text-danger',
                        )}
                    >
                        {totals.missing} belum lapor
                    </span>
                </p>
            </div>

            {reports.missing.length > 0 && (
                <ul aria-label="Belum lapor" className="flex flex-wrap gap-1.5">
                    {reports.missing.map((person) => (
                        <li
                            key={person.id}
                            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface-2 pr-3 pl-1 text-[14px]"
                        >
                            <UserAvatar
                                name={person.name}
                                src={person.avatar}
                                className="size-6 text-[10px]"
                            />
                            {person.name.split(' ')[0]}
                            {person.draft && (
                                <span className="text-[12px] font-bold text-warning">
                                    draf
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            {reports.reports.length === 0 ? (
                <EmptyState
                    size="sm"
                    icon={ClipboardList}
                    title="Belum ada laporan hari ini"
                />
            ) : (
                <ul className="flex flex-col divide-y divide-divider">
                    {sent.map((report) => (
                        <li key={report.id}>
                            <button
                                type="button"
                                onClick={() => detail.open(report.id)}
                                className={cn(
                                    'flex min-h-14 w-full items-center gap-3 rounded-lg py-2 text-left hover:bg-surface-2/50',
                                    focusRing,
                                )}
                                aria-label={`Buka laporan ${report.user.name}`}
                            >
                                <UserAvatar
                                    name={report.user.name}
                                    src={report.user.avatar}
                                    className="size-8 text-[12px]"
                                />
                                <span className="flex min-w-0 flex-1 flex-col">
                                    <span className="truncate text-[16px] font-semibold">
                                        {report.user.name}
                                    </span>
                                    <span className="text-meta text-text-muted">
                                        {report.items_count} tugas
                                    </span>
                                </span>
                                {report.has_blockers && (
                                    <AlertTriangle
                                        className="size-4 shrink-0 text-warning"
                                        aria-label="Ada hambatan"
                                    />
                                )}
                                <span className="flex shrink-0 items-center gap-1 text-meta text-text-muted tnum">
                                    <Clock className="size-3.5" aria-hidden />
                                    {formatTime(report.submitted_at)}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            {reports.reports.length > SHOWN && (
                <Button
                    type="button"
                    variant="quiet"
                    className="-mt-2 self-start px-1"
                    aria-expanded={all}
                    onClick={() => setAll((value) => !value)}
                >
                    {all
                        ? 'Tampilkan lebih sedikit'
                        : `Lihat semua ${reports.reports.length} laporan`}
                </Button>
            )}
            <ReportDetailSheet
                state={detail.state}
                onClose={detail.close}
                mobile={mobile}
            />
        </Panel>
    );
}
