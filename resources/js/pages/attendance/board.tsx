import { Head, Link, router, usePage } from '@inertiajs/react';
import { ChevronRight, Monitor } from 'lucide-react';
import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import {
    DistributionBar,
    LivePill,
    MissingCheckOutPanel,
    PeopleList,
    RecapLink,
    SegmentLegend,
    StatCards,
    divisionTotals,
} from '@/features/attendance/board/parts';
import type { BoardPageProps } from '@/features/attendance/board/types';
import {
    BOARD_PROPS,
    useLiveBoard,
} from '@/features/attendance/board/use-live-board';
import { CorrectionDialog } from '@/features/attendance/review/correction-dialog';
import type { CorrectionTarget } from '@/features/attendance/review/correction-dialog';
import { SuspiciousPanel } from '@/features/attendance/review/suspicious-panel';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { formatDate, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { board as boardRoute } from '@/routes/attendance';
import type { BoardDivision } from '@/types/attendance';

const RELOAD = [...BOARD_PROPS];

/**
 * HR › Absensi hari ini (mockups DashboardHR / MDashboardHR, attendance part):
 * live per-division board, flagged logs, missing check-outs, people list.
 */
export default function AttendanceBoard(props: BoardPageProps) {
    const breakpoint = useBreakpoint();
    const mode = useLiveBoard(props.channels);
    const [correction, setCorrection] = useState<CorrectionTarget | null>(null);
    const { auth } = usePage().props;
    const scope = props.channels.company ? 'seluruh perusahaan' : 'tim Anda';
    const location = props.locations.find(
        (item) => item.id === props.filters.lokasi,
    );
    const subtitle = `${formatDate(props.board.date)} · ${location?.name ?? (props.locations.map((item) => item.name).join(' & ') || 'semua lokasi')} · diperbarui ${formatTime(props.board.generatedAt)}`;

    const changeLocation = (value: string) =>
        router.get(
            boardRoute.url({ query: value === '' ? {} : { lokasi: value } }),
            {},
            { preserveScroll: true, preserveState: true, replace: true },
        );

    const locationSelect = (
        <select
            aria-label="Lokasi"
            value={props.filters.lokasi ?? ''}
            onChange={(event) => changeLocation(event.target.value)}
            className="h-11 rounded-md border border-border bg-surface px-3 text-base text-text lg:h-9 lg:text-sm"
        >
            <option value="">Semua lokasi</option>
            {props.locations.map((item) => (
                <option key={item.id} value={item.id}>
                    {item.name}
                </option>
            ))}
        </select>
    );

    const dialog = (
        <CorrectionDialog
            key={
                correction
                    ? `${correction.userId}-${correction.workDate}`
                    : 'none'
            }
            target={correction}
            today={props.board.date}
            reload={RELOAD}
            onClose={() => setCorrection(null)}
        />
    );

    if (breakpoint === null) {
        return (
            <div className="space-y-4" aria-busy>
                <Skeleton className="h-24 rounded-xl" />
                <Skeleton className="h-72 rounded-xl" />
            </div>
        );
    }

    const isMobile = breakpoint === 'mobile';
    const selfId = auth.user?.id ?? null;

    return (
        <>
            <Head title="Absensi hari ini" />
            {isMobile ? (
                <div className="space-y-4">
                    <header className="space-y-1">
                        <div className="flex items-center gap-2">
                            <h1 className="text-[22px] font-semibold text-text">
                                Absensi hari ini
                            </h1>
                            <LivePill mode={mode} />
                        </div>
                        <p className="text-[13px] text-text-muted">
                            {subtitle}
                        </p>
                        {props.locations.length > 1 && (
                            <div className="pt-2">{locationSelect}</div>
                        )}
                    </header>
                    <StatCards summary={props.board.summary} compact />
                    <DivisionList divisions={props.board.divisions} />
                    <SuspiciousPanel
                        items={props.suspicious.items}
                        total={props.suspicious.total}
                        reload={RELOAD}
                        variant="mobile"
                    />
                    <PeopleList
                        people={props.board.people}
                        divisions={props.divisions}
                        variant="mobile"
                        canCorrect={false}
                        today={props.board.date}
                        onCorrect={setCorrection}
                    />
                    <MissingCheckOutPanel
                        items={props.missingCheckOut}
                        canCorrect={false}
                        onCorrect={setCorrection}
                    />
                    <Link
                        href="/absensi/rekap"
                        className="flex min-h-12 items-center gap-3 rounded-xl bg-surface-2 px-4 text-[15px] text-text-muted"
                    >
                        <Monitor
                            className="size-5"
                            strokeWidth={1.75}
                            aria-hidden
                        />
                        <span className="flex-1">
                            Rekap &amp; ekspor bulanan tersedia di desktop
                        </span>
                        <ChevronRight className="size-4" aria-hidden />
                    </Link>
                </div>
            ) : (
                <div className="space-y-5">
                    <header className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2.5">
                                <h1 className="text-xl leading-7 font-semibold text-text">
                                    Absensi hari ini · {scope}
                                </h1>
                                <LivePill mode={mode} />
                            </div>
                            <p className="text-sm text-text-muted">
                                {subtitle}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {props.locations.length > 1 && (
                                <>
                                    <span className="text-sm text-text-muted">
                                        Lokasi
                                    </span>
                                    {locationSelect}
                                </>
                            )}
                            <RecapLink className="h-9" />
                        </div>
                    </header>
                    <StatCards summary={props.board.summary} />
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
                        <DivisionTable divisions={props.board.divisions} />
                        <SuspiciousPanel
                            items={props.suspicious.items}
                            total={props.suspicious.total}
                            reload={RELOAD}
                        />
                    </div>
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
                        <PeopleList
                            people={props.board.people}
                            divisions={props.divisions}
                            variant="desktop"
                            canCorrect={props.can.correct}
                            selfId={selfId}
                            today={props.board.date}
                            onCorrect={setCorrection}
                        />
                        <MissingCheckOutPanel
                            items={props.missingCheckOut}
                            canCorrect={props.can.correct}
                            selfId={selfId}
                            onCorrect={setCorrection}
                            className="self-start"
                        />
                    </div>
                </div>
            )}
            {dialog}
        </>
    );
}

function DivisionTable({ divisions }: { divisions: BoardDivision[] }) {
    const total = divisionTotals(divisions);
    const rows = [...divisions, total];

    return (
        <section
            aria-labelledby="division-title"
            className="overflow-hidden rounded-xl border border-border bg-surface shadow-card"
        >
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <h2
                    id="division-title"
                    className="text-[15px] font-semibold text-text"
                >
                    Per divisi
                </h2>
                <SegmentLegend />
            </div>
            <table className="w-full text-sm">
                <thead className="bg-surface-2 text-[13px] text-text-muted">
                    <tr>
                        <th
                            scope="col"
                            className="px-4 py-2 text-left font-medium"
                        >
                            Divisi
                        </th>
                        <th
                            scope="col"
                            className="px-2 py-2 text-right font-medium"
                        >
                            Terjadwal
                        </th>
                        <th
                            scope="col"
                            className="w-[34%] px-3 py-2 text-left font-medium"
                        >
                            Distribusi
                        </th>
                        <th
                            scope="col"
                            className="px-2 py-2 text-right font-medium"
                        >
                            Hadir
                        </th>
                        <th
                            scope="col"
                            className="px-2 py-2 text-right font-medium"
                        >
                            Terlambat
                        </th>
                        <th
                            scope="col"
                            className="px-2 py-2 text-right font-medium"
                        >
                            Cuti/izin/sakit
                        </th>
                        <th
                            scope="col"
                            className="px-4 py-2 text-right font-medium"
                        >
                            Belum
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {divisions.length === 0 && (
                        <tr>
                            <td
                                colSpan={7}
                                className="px-4 py-8 text-center text-text-muted"
                            >
                                Tidak ada karyawan terjadwal hari ini.
                            </td>
                        </tr>
                    )}
                    {rows.map((division, index) => {
                        const isTotal = index === rows.length - 1;

                        if (isTotal && divisions.length === 0) {
                            return null;
                        }

                        return (
                            <tr
                                key={division.id ?? `row-${index}`}
                                className={cn(
                                    isTotal && 'bg-surface-2 font-semibold',
                                )}
                            >
                                <td className="px-4 py-2.5 text-text">
                                    {division.name}
                                </td>
                                <td className="px-2 py-2.5 text-right tnum">
                                    {division.scheduled}
                                </td>
                                <td className="px-3 py-2.5">
                                    <DistributionBar division={division} />
                                </td>
                                <td className="px-2 py-2.5 text-right tnum">
                                    {division.onTime + division.late}
                                </td>
                                <td
                                    className={cn(
                                        'px-2 py-2.5 text-right tnum',
                                        division.late > 0 && 'text-warning',
                                    )}
                                >
                                    {division.late}
                                </td>
                                <td className="px-2 py-2.5 text-right tnum">
                                    {division.onLeave}
                                </td>
                                <td className="px-4 py-2.5 text-right tnum">
                                    {division.notCheckedIn}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            <p className="border-t border-border px-4 py-2.5 text-[13px] text-text-muted">
                Kolom Hadir sudah termasuk yang terlambat.{' '}
                <a
                    href="#per-orang"
                    className="text-primary underline-offset-2 hover:underline"
                >
                    Lihat daftar per orang →
                </a>
            </p>
        </section>
    );
}

function DivisionList({ divisions }: { divisions: BoardDivision[] }) {
    const total = divisionTotals(divisions);

    return (
        <section
            aria-labelledby="division-title-m"
            className="overflow-hidden rounded-xl border border-border bg-surface shadow-card"
        >
            <div className="flex items-center justify-between px-4 py-3">
                <h2
                    id="division-title-m"
                    className="text-[17px] font-semibold text-text"
                >
                    Per divisi
                </h2>
                <span className="text-[13px] text-text-muted">
                    Hadir termasuk terlambat
                </span>
            </div>
            <div className="grid grid-cols-[1fr_repeat(4,40px)] bg-surface-2 px-4 py-2 text-xs text-text-muted">
                <span>Divisi · terjadwal</span>
                <span className="text-right">Hadir</span>
                <span className="text-right">Telat</span>
                <span className="text-right">C/I/S</span>
                <span className="text-right">Belum</span>
            </div>
            <ul className="divide-y divide-border">
                {[...divisions, ...(divisions.length > 0 ? [total] : [])].map(
                    (division, index) => (
                        <li
                            key={division.id ?? `m-${index}`}
                            className={cn(
                                'space-y-2 px-4 py-3',
                                index === divisions.length &&
                                    'bg-surface-2 font-semibold',
                            )}
                        >
                            <div className="grid grid-cols-[1fr_repeat(4,40px)] items-baseline text-[15px]">
                                <span className="truncate text-text">
                                    {division.name}{' '}
                                    <span className="text-text-muted">
                                        · {division.scheduled}
                                    </span>
                                </span>
                                <span className="text-right tnum">
                                    {division.onTime + division.late}
                                </span>
                                <span
                                    className={cn(
                                        'text-right tnum',
                                        division.late > 0
                                            ? 'text-warning'
                                            : 'text-text-muted',
                                    )}
                                >
                                    {division.late}
                                </span>
                                <span className="text-right tnum">
                                    {division.onLeave}
                                </span>
                                <span className="text-right tnum">
                                    {division.notCheckedIn}
                                </span>
                            </div>
                            <DistributionBar division={division} />
                        </li>
                    ),
                )}
            </ul>
        </section>
    );
}

AttendanceBoard.layout = {
    width: 'wide',
    breadcrumbs: [
        { title: 'Absensi', href: '/absensi' },
        { title: 'Absensi hari ini', href: '/absensi/hari-ini' },
    ],
    title: 'Absensi hari ini',
    back: '/menu',
};
