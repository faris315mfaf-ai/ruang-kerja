import { Link, router } from '@inertiajs/react';
import { Lock, Plus, Target } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { ChipScroller } from '@/components/mobile/chip-scroller';
import { Fab } from '@/components/mobile/fab';
import { Badge } from '@/components/ui/badge';
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
import { SegmentedTabs } from '@/components/ui/tabs';
import { cn, focusRing } from '@/lib/utils';
import okrRoutes from '@/routes/okr';
import { submit } from './api';
import {
    aggregate,
    groupByDivision,
    quarterLabel,
    quarterWeek,
    summarizeObjective,
} from './lib';
import { ObjectiveFormDialog } from './objective-form-dialog';
import { ProgressRing, STATUS_META, StatusBadge } from './parts';
import type { Objective, OkrIndexProps, QuarterKey } from './types';

function quarterSuffix(quarter: QuarterKey, current: QuarterKey): string {
    if (quarter === current) {
        return ' · berjalan';
    }

    return quarter < current ? ' · selesai' : ' · berikutnya';
}

/**
 * /okr content: quarter & division filters (query string `kuartal`,
 * `divisi`), summary, objectives per division, "Objective baru".
 */
export function OkrList({
    props,
    mobile,
}: {
    props: OkrIndexProps;
    mobile: boolean;
}) {
    const { filters } = props;
    const [loading, setLoading] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const objectives = props.objectives;
    const totals = aggregate(objectives, props.today);
    const { week, weeks } = quarterWeek(filters.quarter, props.today);
    const quarterOver = filters.quarter < props.current_quarter;
    const division = props.divisions.find(
        (item) => item.id === filters.division,
    );

    const visit = (next: { quarter: QuarterKey; division: string }) => {
        router.get(
            okrRoutes.index.url(),
            {
                kuartal:
                    next.quarter === props.current_quarter
                        ? undefined
                        : next.quarter,
                divisi: next.division === 'all' ? undefined : next.division,
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                onStart: () => setLoading(true),
                onFinish: () => setLoading(false),
            },
        );
    };

    const quarterTabs = (
        <SegmentedTabs
            label="Kuartal"
            value={filters.quarter}
            onValueChange={(quarter) =>
                visit({ quarter, division: filters.division })
            }
            options={props.quarters.map((key) => ({
                value: key,
                label: `${quarterLabel(key)}${quarterSuffix(key, props.current_quarter)}`,
            }))}
            className={
                mobile ? 'w-full overflow-x-auto [&>button]:flex-1' : undefined
            }
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
                        {props.divisions.length > 1 && (
                            <Select
                                value={filters.division}
                                onValueChange={(value) =>
                                    visit({
                                        quarter: filters.quarter,
                                        division: value,
                                    })
                                }
                            >
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
                                        <SelectItem
                                            key={item.id}
                                            value={item.id}
                                        >
                                            {item.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                        {props.create && (
                            <Button onClick={() => setCreateOpen(true)}>
                                <Plus aria-hidden />
                                Objective baru
                            </Button>
                        )}
                    </div>
                )}
            </section>

            {mobile && (
                <div className="flex min-w-0 flex-col gap-3">
                    {quarterTabs}
                    {props.divisions.length > 1 && (
                        <ChipScroller
                            label="Divisi"
                            value={filters.division}
                            onChange={(value) =>
                                visit({
                                    quarter: filters.quarter,
                                    division: value,
                                })
                            }
                            chips={[
                                { value: 'all', label: 'Semua' },
                                ...props.divisions.map((item) => ({
                                    value: item.id,
                                    label: item.name,
                                })),
                            ]}
                        />
                    )}
                </div>
            )}

            <div
                aria-busy={loading || undefined}
                className={cn(
                    'flex flex-col gap-6 transition-opacity duration-120 ease-brand',
                    loading && 'opacity-60',
                )}
            >
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
                            quarterOver
                                ? `${quarterLabel(filters.quarter)} sudah berakhir`
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
                            division
                                ? `${division.name} belum punya objective untuk ${quarterLabel(filters.quarter)}.`
                                : `Belum ada objective untuk ${quarterLabel(filters.quarter)}.`
                        }
                        action={
                            props.create ? (
                                <Button
                                    variant="tonal"
                                    onClick={() => setCreateOpen(true)}
                                >
                                    <Plus aria-hidden />
                                    Objective baru
                                </Button>
                            ) : filters.division !== 'all' ? (
                                <Button
                                    variant="outline"
                                    onClick={() =>
                                        visit({
                                            quarter: filters.quarter,
                                            division: 'all',
                                        })
                                    }
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
                                    <li key={objective.id} className="min-w-0">
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
            </div>

            {props.create && (
                <>
                    {mobile && (
                        <Fab
                            label="Objective baru"
                            onClick={() => setCreateOpen(true)}
                        />
                    )}
                    <ObjectiveFormDialog
                        open={createOpen}
                        onOpenChange={setCreateOpen}
                        mobile={mobile}
                        objective={null}
                        divisions={props.create.divisions}
                        people={props.create.people}
                        quarters={props.create.quarters}
                        defaultQuarter={
                            props.create.quarters.includes(filters.quarter)
                                ? filters.quarter
                                : props.current_quarter
                        }
                        defaultDivision={
                            filters.division === 'all'
                                ? undefined
                                : filters.division
                        }
                        processing={saving}
                        onSave={(draft, onErrors) =>
                            submit(
                                okrRoutes.store(),
                                {
                                    ...draft,
                                    title: draft.title.trim(),
                                    description: draft.description.trim(),
                                },
                                {
                                    onErrors,
                                    onStart: () => setSaving(true),
                                    onFinish: () => setSaving(false),
                                },
                            )
                        }
                    />
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
                <span className="text-[17px] leading-6 font-bold break-words text-text">
                    {objective.title}
                </span>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-text-muted">
                    <StatusBadge
                        status={summary.status}
                        className="h-7 text-[14px]"
                    />
                    {objective.status === 'draft' && (
                        <Badge variant="label" tone="warning" className="h-7">
                            Draf
                        </Badge>
                    )}
                    {objective.status === 'closed' && (
                        <Badge variant="label" className="h-7">
                            <Lock aria-hidden className="size-3.5" />
                            Ditutup
                        </Badge>
                    )}
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
