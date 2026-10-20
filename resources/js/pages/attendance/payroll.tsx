import { Head, router } from '@inertiajs/react';
import { Download, Lock, LockOpen, Search, Wallet } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { DesktopOnlyNotice } from '@/components/desktop-only-notice';
import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/ui/kpi-card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { AttendanceTabs } from '@/features/attendance/board/attendance-tabs';
import { shortDate } from '@/features/attendance/employees/cells';
import { FilterSelect } from '@/features/attendance/filter-select';
import {
    formatDays,
    nextMonthStart,
    periodStatus,
} from '@/features/attendance/payroll/payroll';
import { PayrollTable } from '@/features/attendance/payroll/payroll-table';
import { RulesPanel } from '@/features/attendance/payroll/rules-panel';
import type {
    PayrollPageProps,
    PayrollRow,
} from '@/features/attendance/payroll/types';
import { WageDialog } from '@/features/attendance/payroll/wage-dialog';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { formatNumber, toIsoDay } from '@/lib/format';
import { monthLabel, officeMonth, recentMonths } from '@/lib/recap';
import { formatRupiah } from '@/lib/requests';
import { cn } from '@/lib/utils';
import payrollRoutes from '@/routes/attendance/payroll';

const RELOAD = ['report'];

const STATUS_TONE = {
    success: 'success',
    warning: 'warning',
    neutral: 'neutral',
} as const;

/**
 * Absensi › Gaji harian (keputusan pemilik 20 Okt 2026; mockups Gaji &
 * Upah): daily wage × paid days per employee, company pay rules, month
 * lock, Excel export. Direksi reads only (can.manage false). Phones get a
 * summary (docs/PLATFORM.md §3 ◐).
 */
export default function AttendancePayroll(props: PayrollPageProps) {
    const breakpoint = useBreakpoint();
    const [query, setQuery] = useState(props.filters.q ?? '');
    const [editing, setEditing] = useState<PayrollRow | null>(null);
    const [confirmLock, setConfirmLock] = useState(false);
    const [locking, setLocking] = useState(false);
    const report = props.report;
    const meta = report.period;
    const status = periodStatus(meta, props.period.isRunning);
    const today = toIsoDay(props.generatedAt) ?? props.period.end;
    const started = props.period.countedUntil !== null;
    const months = useMemo(
        () => recentMonths(officeMonth(props.generatedAt), 13),
        [props.generatedAt],
    );

    const visit = (changes: Record<string, string | null>, only?: string[]) => {
        const next = {
            bulan: props.filters.bulan,
            divisi: props.filters.divisi,
            q: props.filters.q,
            ...changes,
        };
        const query = Object.fromEntries(
            Object.entries(next).filter(
                ([, value]) => value !== null && value !== '',
            ),
        ) as Record<string, string>;

        router.get(
            payrollRoutes.index.url({ query }),
            {},
            { preserveState: true, preserveScroll: true, replace: true, only },
        );
    };

    useEffect(() => {
        if ((props.filters.q ?? '') === query) {
            return;
        }

        const timer = window.setTimeout(
            () => visit({ q: query }, ['report', 'filters']),
            350,
        );

        return () => window.clearTimeout(timer);
        // visit() reads the current props; only the typed text retriggers.
    }, [query]); // oxlint-disable-line react-hooks/exhaustive-deps

    const exportUrl = payrollRoutes.export.url({
        query: Object.fromEntries(
            Object.entries({
                bulan: props.filters.bulan,
                divisi: props.filters.divisi,
                q: props.filters.q,
            }).filter(([, value]) => value),
        ) as Record<string, string>,
    });

    const toggleLock = () => {
        setLocking(true);
        const options = {
            preserveScroll: true,
            onSuccess: () => setConfirmLock(false),
            onFinish: () => setLocking(false),
        };

        if (meta.locked) {
            router.delete(payrollRoutes.unlock.url(meta.month), options);
        } else {
            router.post(payrollRoutes.lock.url(meta.month), {}, options);
        }
    };

    if (breakpoint === null) {
        return (
            <div className="flex flex-col gap-5" aria-busy>
                <Skeleton className="h-28 rounded-panel" />
                <Skeleton className="h-96 rounded-panel" />
            </div>
        );
    }

    const totalLabel =
        props.period.isRunning && props.period.countedUntil
            ? `Total gaji s.d. ${shortDate(props.period.countedUntil)}`
            : `Total gaji ${props.period.label}`;
    const kpis = (compact: boolean) => (
        <section
            aria-label="Ringkasan gaji"
            className={cn(
                'grid grid-cols-2 gap-3',
                !compact && 'gap-4 xl:grid-cols-4',
            )}
        >
            <KpiCard
                tone="highlight"
                label={totalLabel}
                value={formatRupiah(report.totals.total)}
                note={`${formatNumber(report.totals.employees)} pegawai`}
                className="col-span-2 xl:col-span-1"
            />
            <KpiCard
                label="Hari kerja berjalan"
                value={meta.workdays_elapsed}
                suffix={`/ ${meta.workdays_total} hari`}
            />
            <KpiCard
                label="Hari tidak dibayar"
                value={formatDays(report.totals.unpaid_days)}
                valueClassName={
                    report.totals.unpaid_days > 0 ? 'text-danger' : ''
                }
                note={
                    compact
                        ? null
                        : `${formatNumber(report.totals.absent_days)} di antaranya Alpha`
                }
            />
            <KpiCard
                label="Belum dihitung"
                value={formatDays(report.totals.pending_days)}
                valueClassName={
                    report.totals.pending_days > 0 ? 'text-warning' : ''
                }
                note={compact ? null : 'Perlu koreksi atau belum ada catatan'}
                className={cn(compact && 'col-span-2')}
            />
        </section>
    );
    const statusPill = (
        <Badge variant="status" tone={STATUS_TONE[status.tone]} dot>
            {status.label}
        </Badge>
    );

    if (breakpoint === 'mobile') {
        return (
            <>
                <Head title="Gaji harian" />
                <div className="flex flex-col gap-4">
                    <AttendanceTabs active="payroll" mobile />
                    <p className="text-overline text-text-muted first-letter:uppercase">
                        Gaji harian · {props.period.label}
                    </p>
                    {statusPill}
                    {kpis(true)}
                    <DesktopOnlyNotice feature="Tabel gaji, upah harian, aturan, dan ekspor" />
                </div>
            </>
        );
    }

    const hasFilter = Boolean(props.filters.q || props.filters.divisi);

    return (
        <>
            <Head title={`Gaji harian · ${props.period.label}`} />
            <div className="flex flex-col gap-6">
                <header className="flex flex-wrap items-end justify-between gap-5">
                    <div className="flex min-w-0 flex-col gap-1">
                        <p className="text-overline text-text-muted">
                            Absensi ·{' '}
                            {props.can.manage ? 'khusus HR' : 'baca saja'}
                        </p>
                        <h1 className="text-h1 text-text">
                            Gaji harian · {props.period.label}
                        </h1>
                        <p className="text-body text-text-muted">
                            Gaji = upah harian × hari dibayar − potongan. Angka
                            ikut berubah saat absen dikoreksi.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        {statusPill}
                        <Button asChild variant="outline">
                            <a href={exportUrl} download>
                                <Download aria-hidden />
                                Ekspor Excel
                            </a>
                        </Button>
                        {props.can.manage && (meta.locked || started) && (
                            <Button
                                type="button"
                                variant={meta.locked ? 'outline' : 'default'}
                                onClick={() => setConfirmLock(true)}
                            >
                                {meta.locked ? (
                                    <LockOpen aria-hidden />
                                ) : (
                                    <Lock aria-hidden />
                                )}
                                {meta.locked ? 'Buka kunci' : 'Kunci periode'}
                            </Button>
                        )}
                    </div>
                </header>

                <AttendanceTabs active="payroll" />

                {kpis(false)}

                <div className="flex flex-wrap items-center gap-3">
                    <Select
                        value={props.period.month}
                        onValueChange={(month) => visit({ bulan: month })}
                    >
                        <SelectTrigger aria-label="Bulan" className="min-w-44">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {(months.includes(props.period.month)
                                ? months
                                : [props.period.month, ...months]
                            ).map((month) => (
                                <SelectItem key={month} value={month}>
                                    {monthLabel(month)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {props.divisions.length > 1 && (
                        <FilterSelect
                            label="Divisi"
                            allLabel="Semua divisi"
                            value={props.filters.divisi}
                            onChange={(division) => visit({ divisi: division })}
                            options={props.divisions}
                        />
                    )}
                    <div className="relative w-72">
                        <Search
                            className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-text-subtle"
                            aria-hidden
                        />
                        <Input
                            type="search"
                            aria-label="Cari pegawai"
                            placeholder="Cari nama pegawai"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            className="pl-11"
                        />
                    </div>
                </div>

                <div className="flex flex-wrap items-start gap-5">
                    <div className="min-w-0 flex-[3_1_700px]">
                        {report.rows.length === 0 ? (
                            <EmptyState
                                icon={Wallet}
                                title={
                                    hasFilter
                                        ? 'Tidak ada pegawai yang cocok'
                                        : 'Belum ada pegawai untuk dihitung'
                                }
                                description={
                                    hasFilter
                                        ? 'Ubah pencarian atau divisi.'
                                        : 'Tidak ada pegawai terjadwal atau tercatat pada bulan ini.'
                                }
                            />
                        ) : (
                            <PayrollTable
                                report={report}
                                canManage={props.can.manage && !meta.locked}
                                onEditWage={setEditing}
                            />
                        )}
                    </div>
                    <RulesPanel
                        rules={report.rules}
                        canManage={props.can.manage}
                        locked={meta.locked}
                        reload={RELOAD}
                        className="min-w-0 flex-[1_1_280px] xl:max-w-[300px]"
                    />
                </div>
            </div>

            <WageDialog
                key={editing?.user_id ?? 'none'}
                row={editing}
                defaultFrom={
                    editing?.daily_wage === null
                        ? props.period.start
                        : nextMonthStart(props.period.month)
                }
                today={today}
                reload={RELOAD}
                onClose={() => setEditing(null)}
            />

            <Dialog open={confirmLock} onOpenChange={setConfirmLock}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {meta.locked
                                ? `Buka kunci ${props.period.label}?`
                                : `Kunci periode ${props.period.label}?`}
                        </DialogTitle>
                        <DialogDescription>
                            {meta.locked
                                ? 'Angka gaji kembali dihitung dari absensi dan upah terkini. Absen dan upah bulan ini bisa diubah lagi. Tercatat di audit log.'
                                : 'Angka gaji saat ini disimpan sebagai salinan. Selama terkunci, absen, status manual, dan upah bertanggal di bulan ini tidak bisa diubah. Tercatat di audit log.'}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="quiet"
                            onClick={() => setConfirmLock(false)}
                        >
                            Batal
                        </Button>
                        <Button
                            type="button"
                            variant={meta.locked ? 'destructive' : 'default'}
                            disabled={locking}
                            onClick={toggleLock}
                        >
                            {meta.locked ? 'Buka kunci' : 'Kunci periode'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

AttendancePayroll.layout = {
    width: 'wide',
    breadcrumbs: [
        { title: 'Absensi', href: '/absensi/hari-ini' },
        { title: 'Gaji', href: '/absensi/gaji' },
    ],
    title: 'Gaji harian',
    back: '/menu',
};
