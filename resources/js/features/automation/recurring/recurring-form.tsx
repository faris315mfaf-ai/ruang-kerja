import { CalendarClock } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { SegmentedTabs } from '@/components/ui/tabs';
import { TODAY } from '@/features/automation/fixtures';
import { SelectField, TextField } from '@/features/automation/form-fields';
import { FormSurface } from '@/features/automation/form-surface';
import {
    WEEKDAYS,
    describePattern,
    nextOccurrences,
    validateRecurring,
} from '@/features/automation/recurrence';
import type { RecurringForm as FormValues } from '@/features/automation/recurrence';
import type {
    Person,
    RecurrencePattern,
    Weekday,
    WorkspaceRef,
} from '@/features/automation/types';
import { useFakeMutation } from '@/features/prototype/use-fake-mutation';
import { formatDate } from '@/lib/format';
import { cn, focusRing } from '@/lib/utils';

type Kind = RecurrencePattern['kind'];

const KIND_OPTIONS: { value: Kind; label: string }[] = [
    { value: 'daily', label: 'Harian' },
    { value: 'weekly', label: 'Mingguan' },
    { value: 'monthly', label: 'Bulanan' },
    { value: 'every_n_weeks', label: 'Tiap N minggu' },
];

/** Switching the kind keeps the chosen weekdays where it makes sense. */
function patternOfKind(
    kind: Kind,
    current: RecurrencePattern,
): RecurrencePattern {
    const weekdays: Weekday[] =
        current.kind === 'weekly' || current.kind === 'every_n_weeks'
            ? current.weekdays
            : [1];

    switch (kind) {
        case 'daily':
            return { kind, weekdays_only: true };
        case 'weekly':
            return { kind, weekdays };
        case 'monthly':
            return { kind, day_of_month: 1 };
        case 'every_n_weeks':
            return { kind, interval: 2, weekdays };
    }
}

function WeekdayPicker({
    value,
    onChange,
}: {
    value: Weekday[];
    onChange: (value: Weekday[]) => void;
}) {
    return (
        <div
            role="group"
            aria-label="Hari"
            className="grid grid-cols-7 gap-1 sm:flex sm:flex-wrap sm:gap-1.5"
        >
            {WEEKDAYS.map((day) => {
                const on = value.includes(day.value);

                return (
                    <button
                        key={day.value}
                        type="button"
                        aria-pressed={on}
                        aria-label={day.long}
                        onClick={() =>
                            onChange(
                                on
                                    ? value.filter((d) => d !== day.value)
                                    : [...value, day.value].sort(
                                          (a, b) => a - b,
                                      ),
                            )
                        }
                        className={cn(
                            'flex h-11 min-w-0 items-center justify-center rounded-control text-[15px] font-bold transition-colors duration-120 ease-brand sm:w-11',
                            on
                                ? 'bg-primary bg-grad-aksi text-on-brand'
                                : 'border border-border-strong bg-surface text-text hover:bg-surface-2',
                            focusRing,
                        )}
                    >
                        {day.short}
                    </button>
                );
            })}
        </div>
    );
}

export function RecurringFormSurface({
    open,
    onOpenChange,
    initial,
    editing,
    workspaces,
    people,
    mobile,
    onSaved,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initial: FormValues;
    editing: boolean;
    workspaces: WorkspaceRef[];
    people: Person[];
    mobile: boolean;
    onSaved: (values: FormValues) => void;
}) {
    const [form, setForm] = useState<FormValues>(initial);
    const [submitted, setSubmitted] = useState(false);
    const { processing, run } = useFakeMutation();
    const errors = submitted ? validateRecurring(form) : {};
    const weekdaysOnlyId = useId();
    const { pattern } = form;
    const preview = nextOccurrences(
        { pattern, starts_on: form.starts_on, ends_on: form.ends_on || null },
        TODAY,
        5,
    );
    const set = (patch: Partial<FormValues>) =>
        setForm((f) => ({ ...f, ...patch }));
    const setPattern = (next: RecurrencePattern) => set({ pattern: next });

    const save = async () => {
        setSubmitted(true);

        if (Object.keys(validateRecurring(form)).length > 0) {
            return;
        }

        const ok = await run(() => onSaved(form), {
            success: editing
                ? 'Tugas berulang diperbarui'
                : 'Tugas berulang dibuat',
        });

        if (ok) {
            onOpenChange(false);
        }
    };

    return (
        <FormSurface
            open={open}
            onOpenChange={onOpenChange}
            mobile={mobile}
            wide
            title={editing ? 'Ubah tugas berulang' : 'Tugas berulang baru'}
            description="Tugas dibuat otomatis pukul 07.00 WIB pada setiap tanggal jadwal."
            footer={
                <>
                    <Button
                        variant="quiet"
                        onClick={() => onOpenChange(false)}
                        className="h-12 md:h-11"
                    >
                        Batal
                    </Button>
                    <Button
                        onClick={() => void save()}
                        disabled={processing}
                        className="h-12 md:h-11"
                    >
                        {processing ? 'Menyimpan…' : 'Simpan'}
                    </Button>
                </>
            }
        >
            <TextField
                label="Judul tugas"
                value={form.title}
                placeholder="Mis. Rekap stok mingguan"
                onChange={(title) => set({ title })}
                error={errors.title}
            />
            <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                    label="Workspace"
                    value={form.workspace_id}
                    onChange={(workspace_id) => set({ workspace_id })}
                    options={workspaces.map((w) => ({
                        value: w.id,
                        label: `${w.key} · ${w.name}`,
                    }))}
                    error={errors.workspace_id}
                />
                <SelectField
                    label="Penanggung jawab"
                    value={form.assignee_id || 'none'}
                    onChange={(value) =>
                        set({ assignee_id: value === 'none' ? '' : value })
                    }
                    options={[
                        { value: 'none', label: 'Belum ditentukan' },
                        ...people.map((p) => ({ value: p.id, label: p.name })),
                    ]}
                />
            </div>

            <fieldset className="flex min-w-0 flex-col gap-3 rounded-lg border border-border p-4">
                <legend className="px-1 text-overline text-link">Pola</legend>
                {mobile ? (
                    <SelectField
                        label="Ulangi"
                        value={pattern.kind}
                        onChange={(kind) =>
                            setPattern(patternOfKind(kind as Kind, pattern))
                        }
                        options={KIND_OPTIONS}
                    />
                ) : (
                    <SegmentedTabs
                        label="Ulangi"
                        semantics="radio"
                        value={pattern.kind}
                        onValueChange={(kind) =>
                            setPattern(patternOfKind(kind, pattern))
                        }
                        options={KIND_OPTIONS}
                        className="self-start"
                    />
                )}

                {pattern.kind === 'daily' && (
                    <div className="flex min-h-control items-center gap-3">
                        <Checkbox
                            id={weekdaysOnlyId}
                            checked={pattern.weekdays_only}
                            onCheckedChange={(checked) =>
                                setPattern({
                                    kind: 'daily',
                                    weekdays_only: checked === true,
                                })
                            }
                        />
                        <Label
                            htmlFor={weekdaysOnlyId}
                            className="text-body font-normal"
                        >
                            Hanya hari kerja (Senin–Jumat)
                        </Label>
                    </div>
                )}

                {pattern.kind === 'every_n_weeks' && (
                    <TextField
                        label="Setiap berapa minggu"
                        type="number"
                        min={1}
                        max={12}
                        value={String(pattern.interval)}
                        onChange={(value) =>
                            setPattern({ ...pattern, interval: Number(value) })
                        }
                        inputClassName="w-28"
                    />
                )}

                {(pattern.kind === 'weekly' ||
                    pattern.kind === 'every_n_weeks') && (
                    <div className="flex flex-col gap-1.5">
                        <span className="text-label text-text">Pada hari</span>
                        <WeekdayPicker
                            value={pattern.weekdays}
                            onChange={(weekdays) =>
                                setPattern({ ...pattern, weekdays })
                            }
                        />
                    </div>
                )}

                {pattern.kind === 'monthly' && (
                    <SelectField
                        label="Tanggal"
                        value={String(pattern.day_of_month)}
                        onChange={(value) =>
                            setPattern({
                                kind: 'monthly',
                                day_of_month: Number(value),
                            })
                        }
                        options={Array.from({ length: 31 }, (_, i) => ({
                            value: String(i + 1),
                            label:
                                i === 30 ? '31 (akhir bulan)' : String(i + 1),
                        }))}
                        className="sm:max-w-[200px]"
                    />
                )}
                {pattern.kind === 'monthly' && pattern.day_of_month > 28 && (
                    <p className="text-meta text-text-muted">
                        Bulan yang lebih pendek memakai hari terakhirnya.
                    </p>
                )}
                {errors.pattern && (
                    <p
                        role="alert"
                        className="text-meta font-semibold text-danger"
                    >
                        {errors.pattern}
                    </p>
                )}
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                    label="Mulai"
                    type="date"
                    value={form.starts_on}
                    onChange={(starts_on) => set({ starts_on })}
                    error={errors.starts_on}
                />
                <TextField
                    label="Berakhir (opsional)"
                    type="date"
                    value={form.ends_on}
                    min={form.starts_on}
                    onChange={(ends_on) => set({ ends_on })}
                    error={errors.ends_on}
                    hint="Kosongkan bila berulang terus."
                />
            </div>

            <section
                aria-live="polite"
                aria-label="Pratinjau jadwal"
                className="flex flex-col gap-2 rounded-lg bg-link-soft p-4"
            >
                <p className="flex items-center gap-2 text-[15px] font-bold text-link">
                    <CalendarClock aria-hidden className="size-5" />
                    {describePattern(pattern)} · 5 tanggal berikutnya
                </p>
                {preview.length === 0 ? (
                    <p className="text-[15px] text-text-muted">
                        Tidak ada tanggal yang cocok. Periksa pola dan tanggal.
                    </p>
                ) : (
                    <ol className="flex flex-wrap gap-2">
                        {preview.map((date) => (
                            <li
                                key={date}
                                className="rounded-sm bg-surface px-2.5 py-1 text-[14px] font-semibold text-text tnum"
                            >
                                {date === TODAY ? 'Hari ini' : formatDate(date)}
                            </li>
                        ))}
                    </ol>
                )}
            </section>
        </FormSurface>
    );
}
