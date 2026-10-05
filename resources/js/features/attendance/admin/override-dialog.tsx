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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { override } from '@/routes/admin/attendance/assignments';
import type { AssignmentEmployee, ShiftAssignmentsProps } from './types';

type Props = Pick<ShiftAssignmentsProps, 'shifts' | 'workModes'> & {
    employee: AssignmentEmployee | null;
    today: string;
    onClose: () => void;
};

const DAY_OFF = 'off';
const KEEP_MODE = 'default';

/** Schedule for one date: another shift, a day off or another work mode. */
export function OverrideDialog({
    employee,
    shifts,
    workModes,
    today,
    onClose,
}: Props) {
    const form = useForm({
        user_id: employee?.id ?? '',
        date: today,
        shift_id: shifts[0]?.id ?? DAY_OFF,
        work_mode_override: KEEP_MODE,
    });

    const submit = () => {
        form.transform((data) => ({
            ...data,
            shift_id: data.shift_id === DAY_OFF ? null : data.shift_id,
            work_mode_override:
                data.work_mode_override === KEEP_MODE
                    ? null
                    : data.work_mode_override,
        }));
        form.post(override.url(), { preserveScroll: true, onSuccess: onClose });
    };

    return (
        <Dialog
            open={employee !== null}
            onOpenChange={(next) => !next && onClose()}
        >
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Jadwal khusus · {employee?.name}</DialogTitle>
                    <DialogDescription>
                        Mengalahkan pola mingguan dan hari libur untuk satu
                        tanggal.
                    </DialogDescription>
                </DialogHeader>
                <form
                    id="override-form"
                    className="grid gap-3"
                    onSubmit={(event) => {
                        event.preventDefault();
                        submit();
                    }}
                >
                    <div className="space-y-1.5">
                        <Label htmlFor="override-date">Tanggal</Label>
                        <Input
                            id="override-date"
                            type="date"
                            value={form.data.date}
                            onChange={(e) =>
                                form.setData('date', e.target.value)
                            }
                        />
                        <InputError message={form.errors.date} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="override-shift">Shift</Label>
                        <Select
                            value={form.data.shift_id}
                            onValueChange={(value) =>
                                form.setData('shift_id', value)
                            }
                        >
                            <SelectTrigger id="override-shift">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={DAY_OFF}>
                                    Libur (tidak terjadwal)
                                </SelectItem>
                                {shifts.map((shift) => (
                                    <SelectItem key={shift.id} value={shift.id}>
                                        {shift.name} · {shift.hours}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <InputError message={form.errors.shift_id} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="override-mode">Mode kerja</Label>
                        <Select
                            value={form.data.work_mode_override}
                            onValueChange={(value) =>
                                form.setData('work_mode_override', value)
                            }
                        >
                            <SelectTrigger id="override-mode">
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
                    </div>
                    <InputError message={form.errors.user_id} />
                </form>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Batal
                    </Button>
                    <Button
                        type="submit"
                        form="override-form"
                        disabled={form.processing}
                    >
                        Simpan jadwal
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
