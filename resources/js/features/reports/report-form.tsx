import { CircleAlert, Lock, Plus, Send, X } from 'lucide-react';
import { useId } from 'react';
import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, fieldClasses } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatLongDate, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { CATEGORY_LABELS, STATUS_TONES, statusText } from './lib';
import { TaskPicker } from './task-picker';
import type { ReportFormItem, ReportTaskOption } from './types';
import type { ReportFormApi } from './use-report-form';

type Props = {
    state: ReportFormApi;
    suggestions: ReportTaskOption[];
    limits: { items: number; note: number; text: number };
    mobile: boolean;
};

function ItemRow({
    item,
    index,
    option,
    state,
    noteMax,
    mobile,
}: {
    item: ReportFormItem;
    index: number;
    option: ReportTaskOption | undefined;
    state: ReportFormApi;
    noteMax: number;
    mobile: boolean;
}) {
    const id = useId();
    const error = (field: string) => state.errors[`items.${index}.${field}`];
    const control = cn(mobile && 'h-12 text-[17px]');
    const title = option
        ? option.title
        : item.task_id
          ? 'Tugas'
          : 'Pekerjaan lain (di luar tugas)';

    return (
        <li className="flex flex-col gap-3 rounded-[18px] border border-border bg-surface p-4">
            <div className="flex items-start gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[16px] font-bold text-text">
                        {option && (
                            <span className="font-mono text-[14px] font-semibold text-text-muted">
                                {option.key}
                            </span>
                        )}
                        <span className="min-w-0 break-words">{title}</span>
                    </p>
                    {option && (
                        <p className="text-meta text-text-muted">
                            {option.workspace.name} · {option.status.name}
                        </p>
                    )}
                </div>
                <button
                    type="button"
                    onClick={() => state.removeItem(item.key)}
                    disabled={state.locked}
                    aria-label={`Hapus ${title} dari laporan`}
                    className="flex size-11 shrink-0 items-center justify-center rounded-[12px] text-text-muted hover:bg-surface-2 focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
                >
                    <X className="size-5" aria-hidden />
                </button>
            </div>

            <div className="grid gap-2">
                <Label htmlFor={`${id}-note`}>Catatan progres</Label>
                <Textarea
                    id={`${id}-note`}
                    rows={2}
                    maxLength={noteMax}
                    disabled={state.locked}
                    className={cn('min-h-20', mobile && 'text-[17px]')}
                    placeholder="Apa yang dikerjakan dan hasilnya"
                    value={item.progress_note}
                    onChange={(event) =>
                        state.changeItem(item.key, {
                            progress_note: event.target.value,
                        })
                    }
                />
                <InputError message={error('progress_note')} />
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-[110px_110px_1fr]">
                <div className="grid content-start gap-1.5">
                    <Label htmlFor={`${id}-percent`}>
                        Progres %{' '}
                        <span className="font-normal text-text-muted">
                            (opsional)
                        </span>
                    </Label>
                    <Input
                        id={`${id}-percent`}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={100}
                        disabled={state.locked}
                        className={cn(control, 'tnum')}
                        value={item.percent}
                        onChange={(event) =>
                            state.changeItem(item.key, {
                                percent: event.target.value,
                            })
                        }
                    />
                    <InputError message={error('percent')} />
                </div>
                <div className="grid content-start gap-1.5">
                    <Label htmlFor={`${id}-hours`}>
                        Jam{' '}
                        <span className="font-normal text-text-muted">
                            (opsional)
                        </span>
                    </Label>
                    <Input
                        id={`${id}-hours`}
                        type="number"
                        inputMode="decimal"
                        min={0.25}
                        max={24}
                        step={0.25}
                        disabled={state.locked}
                        className={cn(control, 'tnum')}
                        value={item.hours}
                        onChange={(event) =>
                            state.changeItem(item.key, {
                                hours: event.target.value,
                            })
                        }
                    />
                    <InputError message={error('hours')} />
                </div>
                {option?.can_move && option.statuses.length > 0 && (
                    <div className="col-span-2 grid content-start gap-1.5 md:col-span-1">
                        <Label htmlFor={`${id}-move`}>Pindahkan ke</Label>
                        <select
                            id={`${id}-move`}
                            disabled={state.locked}
                            className={cn(fieldClasses, 'h-11 pr-9', control)}
                            value={item.move_status_id}
                            onChange={(event) =>
                                state.changeItem(item.key, {
                                    move_status_id: event.target.value,
                                })
                            }
                        >
                            <option value="">
                                Tidak dipindah ({option.status.name})
                            </option>
                            {option.statuses
                                .filter(
                                    (column) => column.id !== option.status.id,
                                )
                                .map((column) => (
                                    <option key={column.id} value={column.id}>
                                        {column.name} ·{' '}
                                        {CATEGORY_LABELS[column.category]}
                                    </option>
                                ))}
                        </select>
                        <p className="text-meta text-text-muted">
                            Dipindahkan saat laporan dikirim.
                        </p>
                        <InputError message={error('move_status_id')} />
                    </div>
                )}
            </div>
            <InputError message={error('task_id')} />
        </li>
    );
}

/**
 * /laporan/hari-ini: tasks worked on today with progress notes, other work,
 * summary, blockers and free notes (minutes). Draft autosave; "Kirim" can be
 * repeated until 23.59, then the report is locked.
 */
export function ReportForm({ state, suggestions, limits, mobile }: Props) {
    const { report, form, options } = state;
    const chosen = new Set(
        form.items.flatMap((item) => (item.task_id ? [item.task_id] : [])),
    );
    const full = form.items.length >= limits.items;
    const submitted = report.status === 'submitted';
    const saveLabel =
        state.saveState === 'saving'
            ? 'Menyimpan…'
            : state.saveState === 'error'
              ? 'Draf belum tersimpan'
              : state.savedAt
                ? `Tersimpan ${formatTime(state.savedAt)}`
                : 'Tersimpan otomatis';

    const texts = (
        <>
            {(
                [
                    [
                        'summary',
                        'Ringkasan hari ini',
                        'Hasil utama hari ini dalam beberapa kalimat',
                        3,
                    ],
                    [
                        'blockers',
                        'Hambatan',
                        'Apa yang menghambat atau butuh bantuan (opsional)',
                        2,
                    ],
                    [
                        'notes',
                        'Catatan / notulensi',
                        'Catatan bebas, mis. notulen rapat singkat (opsional)',
                        5,
                    ],
                ] as const
            ).map(([field, label, placeholder, rows]) => (
                <div key={field} className="grid gap-2">
                    <Label htmlFor={`report-${field}`}>{label}</Label>
                    <Textarea
                        id={`report-${field}`}
                        rows={rows}
                        maxLength={limits.text}
                        disabled={state.locked}
                        className={cn(mobile && 'text-[17px]')}
                        placeholder={placeholder}
                        value={form[field]}
                        onChange={(event) =>
                            state.setText(field, event.target.value)
                        }
                    />
                    <InputError message={state.errors[field]} />
                </div>
            ))}
        </>
    );

    const actions = (
        <div className="flex flex-col gap-2">
            <Button
                type="button"
                size={mobile ? 'lg' : 'xl'}
                className="w-full text-[18px] font-extrabold"
                disabled={state.submitting || state.locked}
                onClick={() => void state.submit()}
            >
                <Send aria-hidden />
                {submitted ? 'Kirim ulang perubahan' : 'Kirim laporan'}
            </Button>
            <p
                className="text-center text-meta text-text-muted"
                aria-live="polite"
            >
                {saveLabel} · bisa diubah sampai 23.59
            </p>
        </div>
    );

    return (
        <div className={cn('flex flex-col gap-5', mobile && 'pb-40')}>
            <header className="flex flex-col gap-2">
                <p className="text-overline text-text-muted">
                    {formatLongDate(report.date)}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-display text-text max-md:sr-only">
                        Laporan hari ini
                    </h1>
                    <Badge
                        variant="status"
                        tone={STATUS_TONES[report.status]}
                        dot
                    >
                        {statusText(report.status, report.submitted_at)}
                    </Badge>
                </div>
            </header>

            {state.locked && (
                <div
                    role="alert"
                    className="flex gap-3 rounded-lg bg-warning-soft px-4 py-3 text-[15px] leading-[22px] text-text"
                >
                    <Lock
                        className="mt-0.5 size-5 shrink-0 text-warning"
                        aria-hidden
                    />
                    <p>
                        Laporan tanggal ini sudah terkunci (batas pukul 23.59).
                        Muat ulang halaman untuk menulis laporan hari ini.
                    </p>
                </div>
            )}

            <div className="flex flex-wrap items-start gap-5">
                <section
                    aria-labelledby="report-items-heading"
                    className="flex min-w-0 flex-[999_1_560px] flex-col gap-4 rounded-panel border border-border bg-surface p-5 shadow-card md:p-6"
                >
                    <h2 id="report-items-heading" className="text-h3 text-text">
                        Pekerjaan hari ini
                    </h2>

                    {form.items.length === 0 ? (
                        <p className="rounded-[18px] border border-dashed border-border-strong bg-surface-2/60 px-4 py-6 text-center text-[16px] text-text-muted">
                            Belum ada pekerjaan. Pilih tugas di bawah atau
                            tambahkan pekerjaan lain.
                        </p>
                    ) : (
                        <ul className="flex flex-col gap-3">
                            {form.items.map((item, index) => (
                                <ItemRow
                                    key={item.key}
                                    item={item}
                                    index={index}
                                    option={
                                        item.task_id
                                            ? options.get(item.task_id)
                                            : undefined
                                    }
                                    state={state}
                                    noteMax={limits.note}
                                    mobile={mobile}
                                />
                            ))}
                        </ul>
                    )}
                    {state.errors.items && (
                        <p className="flex items-center gap-1.5 text-meta font-semibold text-danger">
                            <CircleAlert className="size-4" aria-hidden />
                            {state.errors.items}
                        </p>
                    )}

                    {!state.locked && !full && (
                        <>
                            <TaskPicker
                                suggestions={suggestions}
                                chosenIds={chosen}
                                onPick={state.addTask}
                                onFound={state.rememberOptions}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                className="self-start"
                                onClick={state.addOther}
                            >
                                <Plus aria-hidden />
                                Pekerjaan lain (di luar tugas)
                            </Button>
                        </>
                    )}
                    {full && (
                        <p className="text-meta text-text-muted">
                            Maksimal {limits.items} baris pekerjaan.
                        </p>
                    )}
                </section>

                <aside
                    aria-label="Ringkasan laporan"
                    className="flex min-w-0 flex-[1_1_340px] flex-col gap-4 lg:sticky lg:top-[calc(var(--menu-bar-height)+20px)]"
                >
                    <section className="flex flex-col gap-4 rounded-panel border border-border bg-surface p-5 shadow-card md:p-6">
                        {texts}
                    </section>
                    {!mobile && actions}
                </aside>
            </div>

            {mobile && (
                <div className="glass fixed inset-x-0 bottom-[calc(var(--tab-bar-height)+env(safe-area-inset-bottom))] z-30 border-x-0 border-b-0 px-4 pt-3.5 pb-3">
                    {actions}
                </div>
            )}
        </div>
    );
}
