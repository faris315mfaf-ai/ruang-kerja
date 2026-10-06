import { Link, router } from '@inertiajs/react';
import { AlertTriangle, RefreshCw, Target } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { ChipScroller } from '@/components/mobile/chip-scroller';
import { Button } from '@/components/ui/button';
import { KpiBar, KpiCard } from '@/components/ui/kpi-card';
import { Progress } from '@/components/ui/progress';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { SegmentedTabs } from '@/components/ui/tabs';
import { cn, focusRing } from '@/lib/utils';
import {
    aggregate,
    filterObjectives,
    groupByDivision,
    quarterLabel,
    quarterWeek,
    summarizeObjective,
} from './lib';
import { ProgressRing, STATUS_META, StatusBadge } from './parts';
import type { PreviewState } from './preview';
import type { Objective, OkrIndexProps, QuarterKey } from './types';

/** /okr content: filters, portfolio summary, objectives per division. */
export function OkrList({
    props,
    mobile,
    state,
}: {
    props: OkrIndexProps;
    mobile: boolean;
    state: PreviewState;
}) {
    const [quarter, setQuarter] = useState<QuarterKey>(props.current_quarter);
    const [division, setDivision] = useState<string>('all');
    const source = state === 'kosong' ? [] : props.objectives;
    const objectives = useMemo(
        () => filterObjectives(source, { quarter, division }),
        [source, quarter, division],
    );
    const totals = aggregate(objectives, props.today);
    const { week, weeks } = quarterWeek(quarter, props.today);
    const closed = quarter !== props.current_quarter;

    const quarterTabs = (
        <SegmentedTabs
            label="Kuartal"
            value={quarter}
            onValueChange={setQuarter}
            options={props.quarters.map((key) => ({
                value: key,
                label: `${quarterLabel(key)}${key === props.current_quarter ? ' · berjalan' : ' · selesai'}`,
            }))}
            className={mobile ? 'w-full [&>button]:flex-1' : undefined}
        />
    );

    return (
        <div className="flex flex-col gap-6">
            <section className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-1">
                    <h1 className="hidden text-h1 md:block">OKR divisi</h1>
                    <p className="text-[16px] text-text-muted">
                        Objective per kuartal dengan key result yang ditautkan
                        ke tugas.
                    </p>
                </div>
                {!mobile && (
                    <div className="flex flex-wrap items-center gap-3">
                        {quarterTabs}
                        <Select value={division} onValueChange={setDivision}>
                            <SelectTrigger
                                aria-label="Divisi"
                                className="min-w-52"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">
                                    Semua divisi
                                </SelectItem>
                                {props.divisions.map((item) => (
                                    <SelectItem key={item.id} value={item.id}>
                                        {item.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </section>

            {mobile && (
                <div className="flex flex-col gap-3">
                    {quarterTabs}
                    <ChipScroller
                        label="Divisi"
                        value={division}
                        onChange={setDivision}
                        chips={[
                            { value: 'all', label: 'Semua' },
                            ...props.divisions.map((item) => ({
                                value: item.id,
                                label: item.name,
                            })),
                        ]}
                    />
                </div>
            )}

            {state === 'memuat' ? (
                <OkrListSkeleton />
            ) : state === 'galat' ? (
                <EmptyState
                    icon={AlertTriangle}
                    title="OKR gagal dimuat"
                    description="Data objective tidak bisa diambil. Periksa koneksi lalu coba lagi."
                    action={
                        <Button
                            variant="outline"
                            onClick={() =>
                                router.get('/okr', {}, { preserveScroll: true })
                            }
                        >
                            <RefreshCw aria-hidden />
                            Coba lagi
                        </Button>
                    }
                />
            ) : (
                <>
                    <section
                        aria-label="Ringkasan OKR"
                        className="grid grid-cols-2 gap-3 md:gap-5 xl:grid-cols-4"
                    >
                        <KpiCard
                            tone="highlight"
                            className="col-span-2 xl:col-span-1"
                            label="Progres rata-rata"
                            value={`${Math.round(totals.progress * 100)}%`}
                            bar={
                                <KpiBar
                                    value={totals.progress * 100}
                                    label="Progres rata-rata objective"
                                />
                            }
                            note={
                                closed
                                    ? `${quarterLabel(quarter)} sudah ditutup`
                                    : `minggu ${week} dari ${weeks} · ${objectives.length} objective`
                            }
                        />
                        <KpiCard
                            label="Sesuai jalur"
                            value={totals.counts.on_track}
                            valueClassName="text-success"
                            note="objective"
                        />
                        <KpiCard
                            label="Berisiko"
                            value={totals.counts.at_risk}
                            valueClassName="text-warning"
                            note="tertinggal 10–25 poin"
                        />
                        <KpiCard
                            label="Tertinggal"
                            value={totals.counts.behind}
                            valueClassName="text-danger"
                            note="lebih dari 25 poin"
                            className="col-span-2 md:col-span-1"
                        />
                    </section>

                    {objectives.length === 0 ? (
                        <EmptyState
                            icon={Target}
                            title="Belum ada OKR"
                            description={
                                source.length === 0
                                    ? 'Objective divisi untuk kuartal ini belum dibuat.'
                                    : 'Tidak ada objective untuk divisi dan kuartal ini.'
                            }
                            action={
                                source.length > 0 ? (
                                    <Button
                                        variant="outline"
                                        onClick={() => setDivision('all')}
                                    >
                                        Tampilkan semua divisi
                                    </Button>
                                ) : undefined
                            }
                        />
                    ) : (
                        groupByDivision(objectives).map((group) => (
                            <section
                                key={group.division.id}
                                aria-label={group.division.name}
                                className="flex flex-col gap-3"
                            >
                                <h2 className="flex items-baseline gap-2 text-h3">
                                    {group.division.name}
                                    <span className="text-[15px] font-semibold text-text-muted">
                                        {group.items.length} objective
                                    </span>
                                </h2>
                                <ul className="grid gap-3 md:gap-4 lg:grid-cols-2">
                                    {group.items.map((objective) => (
                                        <li
                                            key={objective.id}
                                            className="min-w-0"
                                        >
                                            <ObjectiveCard
                                                objective={objective}
                                                today={props.today}
                                            />
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        ))
                    )}
                </>
            )}
        </div>
    );
}

function ObjectiveCard({
    objective,
    today,
}: {
    objective: Objective;
    today: string;
}) {
    const summary = summarizeObjective(objective, today);
    const flagged = summary.counts.at_risk + summary.counts.behind;

    return (
        <Link
            href={`/okr/${objective.id}`}
            prefetch
            className={cn(
                'flex h-full items-center gap-4 rounded-card border border-border bg-surface p-4 shadow-card transition-colors duration-120 ease-brand hover:bg-background md:p-5',
                focusRing,
            )}
        >
            <ProgressRing
                value={summary.progress}
                status={summary.status}
                size={64}
                label="Progres"
            />
            <span className="flex min-w-0 flex-1 flex-col gap-2">
                <span className="text-[17px] leading-6 font-bold text-text">
                    {objective.title}
                </span>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-text-muted">
                    <StatusBadge
                        status={summary.status}
                        className="h-7 text-[14px]"
                    />
                    <span>
                        {objective.owner.name} · {objective.key_results.length}{' '}
                        KR
                        {flagged > 0 && ` · ${flagged} perlu perhatian`}
                    </span>
                </span>
                <Progress
                    size="sm"
                    value={summary.progress * 100}
                    marker={summary.expected * 100}
                    markerLabel="diharapkan"
                    tone={STATUS_META[summary.status].progress}
                    label={`Progres ${objective.title}`}
                />
            </span>
        </Link>
    );
}

function OkrListSkeleton() {
    return (
        <div className="flex flex-col gap-5" aria-busy aria-label="Memuat">
            <div className="grid grid-cols-2 gap-3 md:gap-5 xl:grid-cols-4">
                {[0, 1, 2, 3].map((key) => (
                    <Skeleton key={key} className="h-32 rounded-card" />
                ))}
            </div>
            <Skeleton className="h-8 w-48" />
            <div className="grid gap-4 lg:grid-cols-2">
                {[0, 1, 2, 3].map((key) => (
                    <Skeleton key={key} className="h-32 rounded-card" />
                ))}
            </div>
        </div>
    );
}
