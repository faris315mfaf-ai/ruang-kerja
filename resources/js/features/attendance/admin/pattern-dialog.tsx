import { useForm } from '@inertiajs/react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { DateInput } from '@/components/ui/date-input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { WEEKDAYS } from '@/lib/attendance';
import { cn, focusRing } from '@/lib/utils';
import { store } from '@/routes/admin/attendance/assignments';
import type { ShiftAssignmentsProps } from './types';

type Props = Pick<
    ShiftAssignmentsProps,
    'divisions' | 'shifts' | 'workModes'
> & {
    open: boolean;
    onClose: () => void;
    selectedIds: string[];
    today: string;
    onApplied: () => void;
};

const KEEP_MODE = 'default';

/** Weekly pattern for the selected employees or a whole division. */
export function PatternDialog({
    open,
    onClose,
    selectedIds,
    divisions,
    shifts,
    workModes,
    today,
    onApplied,
}: Props) {
    const form = useForm({
        target: selectedIds.length > 0 ? 'employees' : 'division',
        user_ids: selectedIds,
        division_id: divisions[0]?.id ?? '',
        shift_id: shifts[0]?.id ?? '',
        weekdays: [1, 2, 3, 4, 5] as number[],
        valid_from: today,
        valid_until: '',
        work_mode_override: KEEP_MODE,
    });

    const toggleDay = (day: number) =>
        form.setData(
            'weekdays',
            form.data.weekdays.includes(day)
                ? form.data.weekdays.filter((d) => d !== day)
                : [...form.data.weekdays, day].sort((a, b) => a - b),
        );

    const submit = () => {
        form.transform((data) => ({
            ...data,
            valid_until: data.valid_until === '' ? null : data.valid_until,
            work_mode_override:
                data.work_mode_override === KEEP_MODE
                    ? null
                    : data.work_mode_override,
        }));
        form.post(store.url(), {
            preserveScroll: true,
            onSuccess: () => {
                onApplied();
                onClose();
            },
        });
    };

    return (
        <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Atur pola shift mingguan</DialogTitle>
                    <DialogDescription>
                        Pola tanpa tanggal akhir menggantikan pola lama pada
                        hari yang sama mulai tanggal berlaku.
                    </DialogDescription>
                </DialogHeader>
                <form
                    id="pattern-form"
                    className="grid gap-3"
                    onSubmit={(event) => {
                        event.preventDefault();
                        submit();
                    }}
                >
                    <fieldset className="space-y-1.5">
                        <legend className="text-label text-text">Untuk</legend>
                        <div className="flex gap-1 rounded-[14px] bg-surface-2 p-1">
                            {[
                                {
                                    value: 'employees',
                                    label: `Karyawan terpilih (${selectedIds.length})`,
                                    disabled: selectedIds.length === 0,
                                },
                                {
                                    value: 'division',
                                    label: 'Satu divisi',
                                    disabled: false,
                                },
                            ].map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    disabled={option.disabled}
                                    aria-pressed={
                                        form.data.target === option.value
                                    }
                                    onClick={() =>
                                        form.setData('target', option.value)
                                    }
                                    className={cn(
                                        'h-[38px] flex-1 rounded-[10px] text-[15px] font-semibold transition-[color,background-color,box-shadow] duration-120 ease-brand disabled:opacity-50',
                                        focusRing,
                                        form.data.target === option.value
                                            ? 'bg-surface text-text shadow-segment'
                                            : 'text-text-muted',
                                    )}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                        <InputError message={form.errors.user_ids} />
                    </fieldset>
                    {form.data.target === 'division' && (
                        <div className="space-y-1.5">
                            <Label htmlFor="pattern-division">
                                Divisi (termasuk sub-divisi)
                            </Label>
                            <Select
                                value={form.data.division_id}
                                onValueChange={(value) =>
                                    form.setData('division_id', value)
                                }
                            >
                                <SelectTrigger id="pattern-division">
                                    <SelectValue placeholder="Pilih divisi" />
                                </SelectTrigger>
                                <SelectContent>
                                    {divisions.map((division) => (
                                        <SelectItem
                                            key={division.id}
                                            value={division.id}
                                        >
                                            {division.name} ({division.code})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <InputError message={form.errors.division_id} />
                        </div>
                    )}
                    <div className="space-y-1.5">
                        <Label htmlFor="pattern-shift">Shift</Label>
                        <Select
                            value={form.data.shift_id}
                            onValueChange={(value) =>
                                form.setData('shift_id', value)
                            }
                        >
                            <SelectTrigger id="pattern-shift">
                                <SelectValue placeholder="Pilih shift" />
                            </SelectTrigger>
                            <SelectContent>
                                {shifts.map((shift) => (
                                    <SelectItem key={shift.id} value={shift.id}>
                                        {shift.name} · {shift.hours}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <InputError message={form.errors.shift_id} />
                    </div>
                    <fieldset className="space-y-1.5">
                        <legend className="text-label text-text">
                            Hari kerja
                        </legend>
                        <div className="flex flex-wrap gap-1.5">
                            {WEEKDAYS.map((day) => (
                                <button
                                    key={day.value}
                                    type="button"
                                    aria-pressed={form.data.weekdays.includes(
                                        day.value,
                                    )}
                                    aria-label={day.long}
                                    onClick={() => toggleDay(day.value)}
                                    className={cn(
                                        'size-11 rounded-control border text-[15px] font-semibold transition-colors duration-120 ease-brand',
                                        focusRing,
                                        form.data.weekdays.includes(day.value)
                                            ? 'border-transparent bg-grad-aksi text-on-brand'
                                            : 'border-border text-text-muted hover:bg-surface-2',
                                    )}
                                >
                                    {day.short}
                                </button>
                            ))}
                        </div>
                        <InputError message={form.errors.weekdays} />
                    </fieldset>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="pattern-from">Berlaku mulai</Label>
                            <DateInput
                                id="pattern-from"
                                clearable={false}
                                value={form.data.valid_from}
                                onChange={(value) =>
                                    form.setData('valid_from', value)
                                }
                            />
                            <InputError message={form.errors.valid_from} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="pattern-until">
                                Sampai (opsional)
                            </Label>
                            <DateInput
                                id="pattern-until"
                                value={form.data.valid_until}
                                onChange={(value) =>
                                    form.setData('valid_until', value)
                                }
                            />
                            <InputError message={form.errors.valid_until} />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="pattern-mode">
                            Mode kerja pada hari ini
                        </Label>
                        <Select
                            value={form.data.work_mode_override}
                            onValueChange={(value) =>
                                form.setData('work_mode_override', value)
                            }
                        >
                            <SelectTrigger id="pattern-mode">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={KEEP_MODE}>
                                    Ikuti mode karyawan
                                </SelectItem>
                                {workModes.map((mode) => (
                                    <SelectItem
                                        key={mode.value}
                                        value={mode.value}
                                    >
                                        {mode.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-meta text-text-muted">
                            Pilih WFH untuk hari kerja dari rumah karyawan
                            hybrid.
                        </p>
                    </div>
                </form>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Batal
                    </Button>
                    <Button
                        type="submit"
                        form="pattern-form"
                        disabled={form.processing}
                    >
                        Terapkan pola
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
