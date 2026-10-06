import { Head, Link, router, usePage } from '@inertiajs/react';
import { ChevronRight, Monitor } from 'lucide-react';
import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { AttendanceTabs } from '@/features/attendance/board/attendance-tabs';
import {
    DivisionBars,
    LivePill,
    MissingCheckOutPanel,
    PeopleList,
    RecapLink,
    StatCards,
} from '@/features/attendance/board/parts';
import type { BoardPageProps } from '@/features/attendance/board/types';
import {
    BOARD_PROPS,
    useLiveBoard,
} from '@/features/attendance/board/use-live-board';
import { FilterSelect } from '@/features/attendance/filter-select';
import { CorrectionDialog } from '@/features/attendance/review/correction-dialog';
import type { CorrectionTarget } from '@/features/attendance/review/correction-dialog';
import { SuspiciousPanel } from '@/features/attendance/review/suspicious-panel';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { formatTime } from '@/lib/format';
import { cn, focusRing } from '@/lib/utils';
import { board as boardRoute } from '@/routes/attendance';

const RELOAD = [...BOARD_PROPS];

/** "SENIN, 5 OKTOBER 2026 · 09.14" overline. */
function overline(date: string, generatedAt: string): string {
    const day = new Intl.DateTimeFormat('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(new Date(`${date}T05:00:00Z`));

    return `${day} · ${formatTime(generatedAt)}`;
}

/**
 * HR › Absensi hari ini (DHR live part, PHRLive, TfAbsensi): summary KPIs,
 * attendance per division, flagged logs, people list, missing check-outs.
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
    const where =
        location?.name ??
        (props.locations.map((item) => item.name).join(' & ') ||
            'semua lokasi');
    const subtitle = `${props.board.summary.scheduled} karyawan terjadwal · ${where} · ${scope}`;

    const changeLocation = (value: string | null) =>
        router.get(
            boardRoute.url({ query: value === null ? {} : { lokasi: value } }),
            {},
            { preserveScroll: true, preserveState: true, replace: true },
        );

    const locationSelect = props.locations.length > 1 && (
        <FilterSelect
            label="Lokasi"
            allLabel="Semua lokasi"
            value={props.filters.lokasi}
            onChange={changeLocation}
            options={props.locations}
        />
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
            <div className="flex flex-col gap-5" aria-busy>
                <Skeleton className="h-28 rounded-panel" />
                <Skeleton className="h-72 rounded-panel" />
            </div>
        );
    }

    const isMobile = breakpoint === 'mobile';
    const selfId = auth.user?.id ?? null;

    return (
        <>
            <Head title="Absensi hari ini" />
            {isMobile ? (
                <div className="flex flex-col gap-4">
                    <AttendanceTabs active="today" mobile />
                    <header className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <p className="text-overline text-link">
                                Diperbarui {formatTime(props.board.generatedAt)}
                            </p>
                            <LivePill mode={mode} />
                        </div>
                        <p className="text-body text-text-muted">{subtitle}</p>
                        {locationSelect && (
                            <div className="[&>button]:w-full">
                                {locationSelect}
                            </div>
                        )}
                    </header>
                    <StatCards summary={props.board.summary} compact />
                    <PeopleList
                        people={props.board.people}
                        divisions={props.divisions}
                        variant="mobile"
                        canCorrect={false}
                        today={props.board.date}
                        onCorrect={setCorrection}
                    />
                    <DivisionBars divisions={props.board.divisions} compact />
                    <SuspiciousPanel
                        items={props.suspicious.items}
                        total={props.suspicious.total}
                        reload={RELOAD}
                        variant="mobile"
                    />
                    <MissingCheckOutPanel
                        items={props.missingCheckOut}
                        canCorrect={false}
                        onCorrect={setCorrection}
                    />
                    <Link
                        href="/absensi/rekap"
                        className={cn(
                            'flex min-h-14 items-center gap-3 rounded-lg border border-border bg-surface px-4 text-[16px] font-semibold text-text',
                            focusRing,
                        )}
                    >
                        <Monitor
                            className="size-5 text-link"
                            strokeWidth={1.9}
                            aria-hidden
                        />
                        <span className="flex-1">
                            Rekap bulanan (ekspor di desktop)
                        </span>
                        <ChevronRight
                            className="size-5 text-text-subtle"
                            aria-hidden
                        />
                    </Link>
                </div>
            ) : (
                <div className="flex flex-col gap-6">
                    <header className="flex flex-wrap items-end justify-between gap-5">
                        <div className="flex flex-col gap-2">
                            <p className="text-overline text-link">
                                {overline(
                                    props.board.date,
                                    props.board.generatedAt,
                                )}
                            </p>
                            <div className="flex flex-wrap items-center gap-3">
                                <h1 className="text-display text-text">
                                    Absensi hari ini
                                </h1>
                                <LivePill mode={mode} />
                            </div>
                            <p className="text-body-lg text-text-muted">
                                {subtitle}
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            {locationSelect}
                            <RecapLink />
                        </div>
                    </header>
                    <AttendanceTabs active="today" />
                    <StatCards summary={props.board.summary} />
                    <div className="flex flex-wrap items-start gap-5">
                        <div className="flex min-w-0 flex-[1.5_1_560px] flex-col gap-5">
                            <DivisionBars divisions={props.board.divisions} />
                            <PeopleList
                                people={props.board.people}
                                divisions={props.divisions}
                                variant="desktop"
                                canCorrect={props.can.correct}
                                selfId={selfId}
                                today={props.board.date}
                                onCorrect={setCorrection}
                            />
                        </div>
                        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-5">
                            <SuspiciousPanel
                                items={props.suspicious.items}
                                total={props.suspicious.total}
                                reload={RELOAD}
                            />
                            <MissingCheckOutPanel
                                items={props.missingCheckOut}
                                canCorrect={props.can.correct}
                                selfId={selfId}
                                onCorrect={setCorrection}
                            />
                        </div>
                    </div>
                </div>
            )}
            {dialog}
        </>
    );
}

AttendanceBoard.layout = {
    breadcrumbs: [
        { title: 'Absensi', href: '/absensi/hari-ini' },
        { title: 'Hari ini', href: '/absensi/hari-ini' },
    ],
    title: 'Absensi hari ini',
    back: '/menu',
};
