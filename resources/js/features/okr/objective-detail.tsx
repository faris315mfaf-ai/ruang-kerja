import { Link } from '@inertiajs/react';
import {
    ArrowLeft,
    ListChecks,
    Pencil,
    Plus,
    Target,
    TrendingDown,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/empty-state';
import { BottomSheet } from '@/components/mobile/bottom-sheet';
import { Fab } from '@/components/mobile/fab';
import { UserAvatar } from '@/components/shell/user-avatar';
import { STATUS_CATEGORY_LABELS, StatusIcon } from '@/components/status-icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/ui/kpi-card';
import { Panel } from '@/components/ui/panel';
import { Progress } from '@/components/ui/progress';
import { formatDate, formatRelative } from '@/lib/format';
import { cn, focusRing } from '@/lib/utils';
import { CheckinDialog } from './checkin-dialog';
import { OKR_NOW, OKR_TODAY } from './fixtures';
import { KrChart } from './kr-chart';
import { KrFormDialog } from './kr-form-dialog';
import {
    formatKrValue,
    krProgress,
    krRawProgress,
    krStatus,
    quarterLabel,
    quarterWeek,
} from './lib';
import { ProgressRing, STATUS_META, StatusBadge } from './parts';
import type { KeyResult, Objective } from './types';
import { useObjective } from './use-objective';

/** /okr/{objective} content (desktop/tablet two columns, phone stacked). */
export function ObjectiveDetail({
    initial,
    mobile,
}: {
    initial: Objective;
    mobile: boolean;
}) {
    const { objective, summary, processing, saveKr, checkin } =
        useObjective(initial);
    const [selectedId, setSelectedId] = useState<string | null>(
        initial.key_results[0]?.id ?? null,
    );
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<KeyResult | null>(null);
    const [checkinFor, setCheckinFor] = useState<KeyResult | null>(null);
    const [checkinOpen, setCheckinOpen] = useState(false);
    const [sheetFor, setSheetFor] = useState<string | null>(null);

    const krs = objective.key_results;
    const selected = krs.find((kr) => kr.id === selectedId) ?? krs[0] ?? null;
    const sheetKr = krs.find((kr) => kr.id === sheetFor) ?? null;
    const { week, weeks } = quarterWeek(objective.quarter, OKR_TODAY);
    const closed = summary.expected >= 1;
    const tasks = krs.flatMap((kr) => kr.tasks);
    const doneTasks = tasks.filter(
        (task) => task.status_category === 'done',
    ).length;
    const lastCheckin = krs
        .flatMap((kr) => kr.checkins)
        .sort((a, b) => b.date.localeCompare(a.date))[0];

    const openForm = (kr: KeyResult | null) => {
        setEditing(kr);
        setFormOpen(true);
    };
    const openCheckin = (kr: KeyResult) => {
        setCheckinFor(kr);
        setCheckinOpen(true);
    };

    return (
        <div className="flex flex-col gap-6">
            {!mobile && (
                <Link
                    href="/okr"
                    className={cn(
                        'inline-flex min-h-11 w-fit items-center gap-1.5 rounded-control px-1 text-[16px] font-semibold text-link',
                        focusRing,
                    )}
                >
                    <ArrowLeft aria-hidden className="size-4" />
                    Semua OKR
                </Link>
            )}

            <section className="flex flex-col gap-6 rounded-panel border border-border bg-surface p-5 shadow-card md:flex-row md:items-center md:p-7">
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="label" tone="link">
                            {objective.division.code} ·{' '}
                            {objective.division.name}
                        </Badge>
                        <Badge variant="label">
                            {quarterLabel(objective.quarter, true)}
                        </Badge>
                    </div>
                    <h1 className="text-h2">{objective.title}</h1>
                    {objective.description && (
                        <p className="text-[16px] leading-6 text-text-muted">
                            {objective.description}
                        </p>
                    )}
                    <p className="flex flex-wrap items-center gap-2 text-[15px] text-text-muted">
                        <UserAvatar
                            name={objective.owner.name}
                            className="size-7"
                        />
                        <span>
                            PIC{' '}
                            <b className="font-semibold text-text">
                                {objective.owner.name}
                            </b>{' '}
                            · diperbarui{' '}
                            {formatRelative(objective.updated_at, OKR_NOW)}
                        </span>
                    </p>
                </div>
                <div className="flex items-center gap-5">
                    <ProgressRing
                        value={summary.progress}
                        status={summary.status}
                        size={mobile ? 96 : 120}
                        stroke={10}
                        label="Progres objective"
                    >
                        <span className="text-[26px] leading-8 font-extrabold tnum">
                            {Math.round(summary.progress * 100)}%
                        </span>
                        <span className="text-[13px] font-semibold text-text-muted">
                            progres
                        </span>
                    </ProgressRing>
                    <div className="flex flex-col gap-1.5">
                        <StatusBadge status={summary.status} />
                        <span className="text-[15px] text-text-muted">
                            Diharapkan {Math.round(summary.expected * 100)}%
                        </span>
                        <span className="text-[15px] text-text-muted">
                            {closed
                                ? 'Kuartal sudah ditutup'
                                : `Minggu ${week} dari ${weeks}`}
                        </span>
                        {summary.regressed > 0 && (
                            <span className="inline-flex items-center gap-1 text-[14px] font-semibold text-danger">
                                <TrendingDown aria-hidden className="size-4" />
                                {summary.regressed} KR mundur dari nilai awal
                            </span>
                        )}
                    </div>
                </div>
            </section>

            <section
                aria-label="Ringkasan objective"
                className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5"
            >
                <KpiCard
                    label="Key result"
                    value={krs.length}
                    note={`${summary.counts.on_track} sesuai jalur · ${summary.counts.at_risk} berisiko · ${summary.counts.behind} tertinggal`}
                />
                <KpiCard
                    label="Check-in terakhir"
                    value={
                        lastCheckin
                            ? formatDate(lastCheckin.date).replace(
                                  / \d{4}$/,
                                  '',
                              )
                            : '–'
                    }
                    valueClassName="text-[22px] leading-7 md:text-[32px] md:leading-10"
                    note={
                        lastCheckin
                            ? `oleh ${lastCheckin.author.name}`
                            : 'belum ada check-in'
                    }
                />
                <KpiCard
                    label="Tugas tertaut"
                    value={tasks.length}
                    note={`${doneTasks} selesai · ${tasks.length - doneTasks} terbuka`}
                    className="col-span-2 md:col-span-1"
                />
            </section>

            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
                <Panel
                    title="Key result"
                    action={
                        !mobile && (
                            <Button size="sm" onClick={() => openForm(null)}>
                                <Plus aria-hidden />
                                Tambah key result
                            </Button>
                        )
                    }
                >
                    {krs.length === 0 ? (
                        <EmptyState
                            size="sm"
                            icon={Target}
                            title="Belum ada key result"
                            description="Tambahkan 2–5 hasil terukur untuk objective ini."
                            action={
                                <Button
                                    variant="tonal"
                                    onClick={() => openForm(null)}
                                >
                                    <Plus aria-hidden />
                                    Tambah key result
                                </Button>
                            }
                        />
                    ) : (
                        <ul className="flex flex-col gap-3">
                            {krs.map((kr) => (
                                <li key={kr.id}>
                                    <KrCard
                                        kr={kr}
                                        expected={summary.expected}
                                        totalWeight={krs.reduce(
                                            (sum, item) => sum + item.weight,
                                            0,
                                        )}
                                        selected={
                                            !mobile && selected?.id === kr.id
                                        }
                                        mobile={mobile}
                                        onSelect={() =>
                                            mobile
                                                ? setSheetFor(kr.id)
                                                : setSelectedId(kr.id)
                                        }
                                        onCheckin={() => openCheckin(kr)}
                                        onEdit={() => openForm(kr)}
                                    />
                                </li>
                            ))}
                        </ul>
                    )}
                </Panel>

                {!mobile && selected && (
                    <Panel
                        title={
                            <span className="line-clamp-2">
                                {selected.title}
                            </span>
                        }
                        className="xl:sticky xl:top-[calc(var(--menu-bar-height)+20px)]"
                    >
                        <KrDetailBody kr={selected} objective={objective} />
                    </Panel>
                )}
            </div>

            {mobile && (
                <>
                    <Fab
                        label="Tambah key result"
                        onClick={() => openForm(null)}
                    />
                    <BottomSheet
                        open={sheetKr !== null}
                        onOpenChange={(open) => !open && setSheetFor(null)}
                        title={sheetKr?.title ?? 'Detail key result'}
                        description={
                            sheetKr
                                ? `${sheetKr.owner.name} · ${formatKrValue(sheetKr.current_value, sheetKr.unit, sheetKr.unit_label)} dari ${formatKrValue(sheetKr.target_value, sheetKr.unit, sheetKr.unit_label)}`
                                : undefined
                        }
                        footer={
                            sheetKr && (
                                <Button
                                    size="lg"
                                    className="w-full"
                                    onClick={() => {
                                        setSheetFor(null);
                                        openCheckin(sheetKr);
                                    }}
                                >
                                    Check-in progres
                                </Button>
                            )
                        }
                    >
                        {sheetKr && (
                            <KrDetailBody
                                kr={sheetKr}
                                objective={objective}
                                compact
                            />
                        )}
                    </BottomSheet>
                </>
            )}

            <KrFormDialog
                open={formOpen}
                onOpenChange={setFormOpen}
                mobile={mobile}
                keyResult={editing}
                defaultOwner={objective.owner.id}
                processing={processing}
                onSave={(draft) => saveKr(draft, editing)}
            />
            <CheckinDialog
                open={checkinOpen}
                onOpenChange={setCheckinOpen}
                mobile={mobile}
                keyResult={checkinFor}
                processing={processing}
                onSave={(value, confidence, note) =>
                    checkinFor
                        ? checkin(checkinFor, value, confidence, note)
                        : Promise.resolve(false)
                }
            />
        </div>
    );
}

function KrCard({
    kr,
    expected,
    totalWeight,
    selected,
    mobile,
    onSelect,
    onCheckin,
    onEdit,
}: {
    kr: KeyResult;
    expected: number;
    totalWeight: number;
    selected: boolean;
    mobile: boolean;
    onSelect: () => void;
    onCheckin: () => void;
    onEdit: () => void;
}) {
    const status = krStatus(kr, expected);
    const format = (value: number) =>
        formatKrValue(value, kr.unit, kr.unit_label);
    const share =
        totalWeight > 0 ? Math.round((kr.weight / totalWeight) * 100) : 0;

    return (
        <article
            aria-current={selected ? 'true' : undefined}
            className={cn(
                'flex flex-col gap-3 rounded-card border bg-surface p-4 transition-colors duration-120 ease-brand',
                selected
                    ? 'border-primary ring-1 ring-primary'
                    : 'border-border',
            )}
        >
            <div className="flex items-start gap-3">
                <button
                    type="button"
                    onClick={onSelect}
                    aria-label={`${mobile ? 'Buka detail' : 'Tampilkan detail'} ${kr.title}`}
                    className={cn(
                        'flex min-h-11 min-w-0 flex-1 flex-col items-start gap-1 rounded-control text-left',
                        focusRing,
                    )}
                >
                    <span className="text-[17px] leading-6 font-bold text-text">
                        {kr.title}
                    </span>
                    <span className="flex items-center gap-2 text-[14px] text-text-muted">
                        <UserAvatar
                            name={kr.owner.name}
                            className="size-6 text-[11px]"
                        />
                        {kr.owner.name} · bobot {share}%
                    </span>
                </button>
                <StatusBadge status={status} className="h-7 text-[14px]" />
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="text-[22px] leading-7 font-extrabold tnum">
                    {format(kr.current_value)}
                </span>
                <span className="text-[14px] text-text-muted tnum">
                    awal {format(kr.start_value)} · target{' '}
                    {format(kr.target_value)}
                </span>
            </div>
            <Progress
                value={krProgress(kr) * 100}
                marker={expected * 100}
                markerLabel="diharapkan"
                tone={STATUS_META[status].progress}
                label={`Progres ${kr.title}`}
            />
            {krRawProgress(kr) < 0 && (
                <p className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-danger">
                    <TrendingDown aria-hidden className="size-4" />
                    Mundur dari nilai awal
                </p>
            )}
            <div className="flex flex-wrap gap-2">
                <Button
                    variant="tonal"
                    size="sm"
                    className="h-11 md:h-9"
                    onClick={onCheckin}
                >
                    Check-in
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-11 md:h-9"
                    onClick={onEdit}
                    aria-label={`Ubah ${kr.title}`}
                >
                    <Pencil aria-hidden />
                    Ubah
                </Button>
                <span className="ml-auto inline-flex items-center gap-1 self-center text-[14px] text-text-muted">
                    <ListChecks aria-hidden className="size-4" />
                    {kr.tasks.length} tugas
                </span>
            </div>
        </article>
    );
}

function KrDetailBody({
    kr,
    objective,
    compact = false,
}: {
    kr: KeyResult;
    objective: Objective;
    compact?: boolean;
}) {
    const format = (value: number) =>
        formatKrValue(value, kr.unit, kr.unit_label);
    const history = [...kr.checkins].sort((a, b) =>
        b.date.localeCompare(a.date),
    );
    const chronological = [...kr.checkins].sort((a, b) =>
        a.date.localeCompare(b.date),
    );
    const previousOf = (id: string) => {
        const index = chronological.findIndex((item) => item.id === id);

        return index > 0 ? chronological[index - 1].value : kr.start_value;
    };

    return (
        <div className="flex flex-col gap-5">
            <KrChart
                keyResult={kr}
                quarter={objective.quarter}
                today={OKR_TODAY}
                compact={compact}
            />

            <section
                aria-label="Riwayat check-in"
                className="flex flex-col gap-2"
            >
                <h3 className="text-overline text-text-muted">
                    Riwayat check-in
                </h3>
                {history.length === 0 ? (
                    <p className="text-[15px] text-text-muted">
                        Belum ada check-in.
                    </p>
                ) : (
                    <ol className="flex flex-col">
                        {history.slice(0, compact ? 4 : 6).map((item) => {
                            const delta = item.value - previousOf(item.id);
                            const towardTarget =
                                Math.sign(delta) ===
                                Math.sign(kr.target_value - kr.start_value);

                            return (
                                <li
                                    key={item.id}
                                    className="flex gap-3 border-t border-divider py-3 first:border-t-0"
                                >
                                    <UserAvatar
                                        name={item.author.name}
                                        className="size-8"
                                    />
                                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                        <span className="flex flex-wrap items-baseline justify-between gap-x-2">
                                            <span className="text-[15px] font-bold tnum">
                                                {format(item.value)}
                                                {delta !== 0 && (
                                                    <span
                                                        className={cn(
                                                            'ml-1.5 text-[14px] font-semibold',
                                                            towardTarget
                                                                ? 'text-success'
                                                                : 'text-danger',
                                                        )}
                                                    >
                                                        {delta > 0 ? '+' : '−'}
                                                        {formatKrValue(
                                                            Math.abs(delta),
                                                            kr.unit,
                                                            '',
                                                        )}
                                                    </span>
                                                )}
                                            </span>
                                            <span className="text-[13px] text-text-muted">
                                                {formatDate(item.date)}
                                            </span>
                                        </span>
                                        <span className="text-[14px] text-text-muted">
                                            {item.author.name}
                                            {item.confidence !== null &&
                                                ` · keyakinan ${item.confidence}/10`}
                                        </span>
                                        {item.note && (
                                            <span className="text-[14px] leading-5">
                                                {item.note}
                                            </span>
                                        )}
                                    </span>
                                </li>
                            );
                        })}
                    </ol>
                )}
            </section>

            <section aria-label="Tugas tertaut" className="flex flex-col gap-2">
                <h3 className="text-overline text-text-muted">Tugas tertaut</h3>
                {kr.tasks.length === 0 ? (
                    <EmptyState
                        size="sm"
                        icon={ListChecks}
                        title="Belum ada tugas tertaut"
                        description="Tautkan tugas agar progres KR terlihat dari pekerjaan tim."
                        action={
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-11 md:h-9"
                                onClick={() =>
                                    toast.info(
                                        'Memilih tugas tersedia saat modul OKR aktif.',
                                    )
                                }
                            >
                                Tautkan tugas
                            </Button>
                        }
                    />
                ) : (
                    <ul className="flex flex-col">
                        {kr.tasks.map((task) => (
                            <li
                                key={task.id}
                                className="flex min-h-14 items-center gap-3 border-t border-divider py-2 first:border-t-0"
                            >
                                <StatusIcon
                                    category={task.status_category}
                                    label={
                                        STATUS_CATEGORY_LABELS[
                                            task.status_category
                                        ]
                                    }
                                />
                                <span className="flex min-w-0 flex-1 flex-col">
                                    <span className="truncate text-[15px] font-semibold">
                                        <span className="mr-1.5 font-mono text-[14px] text-text-muted">
                                            {task.key}
                                        </span>
                                        {task.title}
                                    </span>
                                    <span className="text-[13px] text-text-muted">
                                        {
                                            STATUS_CATEGORY_LABELS[
                                                task.status_category
                                            ]
                                        }
                                        {task.due_date &&
                                            ` · tenggat ${formatDate(task.due_date)}`}
                                    </span>
                                </span>
                                {task.assignee && (
                                    <UserAvatar
                                        name={task.assignee.name}
                                        className="size-7"
                                    />
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}
