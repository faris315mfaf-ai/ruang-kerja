import { Link, router, useForm } from '@inertiajs/react';
import { MoreHorizontal, Plus, Users } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import shiftRoutes from '@/routes/admin/attendance/shifts';
import { index as assignmentsIndex } from '@/routes/admin/attendance/assignments';
import { SectionCard } from './section-card';
import type { AdminShift, AttendanceSettingsProps } from './types';

type Props = Pick<
    AttendanceSettingsProps,
    'shifts' | 'locations' | 'shiftDefaults'
>;

type ShiftForm = {
    name: string;
    start_time: string;
    end_time: string;
    break_minutes: number;
    late_tolerance_min: number;
    early_leave_tolerance_min: number;
    check_in_window_before_min: number;
    office_location_id: string;
};

const ANY_LOCATION = 'any';

function NumberField({
    id,
    label,
    value,
    onChange,
    error,
    suffix = 'menit',
}: {
    id: string;
    label: string;
    value: number;
    onChange: (value: number) => void;
    error?: string;
    suffix?: string;
}) {
    return (
        <div className="space-y-1.5">
            <Label htmlFor={id}>{label}</Label>
            <div className="flex items-center gap-2">
                <Input
                    id={id}
                    type="number"
                    min={0}
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                    className="tnum"
                />
                <span className="shrink-0 text-xs text-text-muted">
                    {suffix}
                </span>
            </div>
            <InputError message={error} />
        </div>
    );
}

function ShiftDialog({
    shift,
    open,
    onClose,
    locations,
    defaults,
}: {
    shift: AdminShift | null;
    open: boolean;
    onClose: () => void;
    locations: Props['locations'];
    defaults: Props['shiftDefaults'];
}) {
    const form = useForm<ShiftForm>({
        name: shift?.name ?? '',
        start_time: shift?.startTime ?? '08:00',
        end_time: shift?.endTime ?? '17:00',
        break_minutes: shift?.breakMinutes ?? 60,
        late_tolerance_min:
            shift?.lateToleranceMin ?? defaults.lateToleranceMin,
        early_leave_tolerance_min: shift?.earlyLeaveToleranceMin ?? 0,
        check_in_window_before_min:
            shift?.checkInWindowBeforeMin ?? defaults.checkInWindowBeforeMin,
        office_location_id: shift?.officeLocationId ?? ANY_LOCATION,
    });
    const crosses = form.data.end_time <= form.data.start_time;

    const submit = () => {
        form.transform((data) => ({
            ...data,
            office_location_id:
                data.office_location_id === ANY_LOCATION
                    ? null
                    : data.office_location_id,
        }));
        const options = { preserveScroll: true, onSuccess: onClose };

        if (shift) {
            form.put(shiftRoutes.update.url(shift.id), options);
        } else {
            form.post(shiftRoutes.store.url(), options);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>
                        {shift ? `Ubah shift ${shift.name}` : 'Tambah shift'}
                    </DialogTitle>
                    <DialogDescription>
                        Check-in setelah jam masuk + toleransi tercatat
                        terlambat.
                    </DialogDescription>
                </DialogHeader>
                <form
                    id="shift-form"
                    className="grid gap-3"
                    onSubmit={(event) => {
                        event.preventDefault();
                        submit();
                    }}
                >
                    <div className="space-y-1.5">
                        <Label htmlFor="shift-name">Nama shift</Label>
                        <Input
                            id="shift-name"
                            value={form.data.name}
                            onChange={(e) =>
                                form.setData('name', e.target.value)
                            }
                            placeholder="Reguler"
                        />
                        <InputError message={form.errors.name} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="shift-start">Jam masuk</Label>
                            <Input
                                id="shift-start"
                                type="time"
                                value={form.data.start_time}
                                onChange={(e) =>
                                    form.setData('start_time', e.target.value)
                                }
                                className="font-mono"
                            />
                            <InputError message={form.errors.start_time} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="shift-end">Jam pulang</Label>
                            <Input
                                id="shift-end"
                                type="time"
                                value={form.data.end_time}
                                onChange={(e) =>
                                    form.setData('end_time', e.target.value)
                                }
                                className="font-mono"
                            />
                            <InputError message={form.errors.end_time} />
                        </div>
                    </div>
                    {crosses && form.data.end_time !== form.data.start_time && (
                        <p className="rounded-md bg-info-soft px-3 py-2 text-xs text-info">
                            Shift lintas tengah malam: dicatat pada tanggal
                            check-in.
                        </p>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                        <NumberField
                            id="shift-break"
                            label="Istirahat"
                            value={form.data.break_minutes}
                            onChange={(v) => form.setData('break_minutes', v)}
                            error={form.errors.break_minutes}
                        />
                        <NumberField
                            id="shift-window"
                            label="Boleh check-in sebelum"
                            value={form.data.check_in_window_before_min}
                            onChange={(v) =>
                                form.setData('check_in_window_before_min', v)
                            }
                            error={form.errors.check_in_window_before_min}
                        />
                        <NumberField
                            id="shift-late"
                            label="Toleransi terlambat"
                            value={form.data.late_tolerance_min}
                            onChange={(v) =>
                                form.setData('late_tolerance_min', v)
                            }
                            error={form.errors.late_tolerance_min}
                        />
                        <NumberField
                            id="shift-early"
                            label="Toleransi pulang cepat"
                            value={form.data.early_leave_tolerance_min}
                            onChange={(v) =>
                                form.setData('early_leave_tolerance_min', v)
                            }
                            error={form.errors.early_leave_tolerance_min}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="shift-location">Lokasi check-in</Label>
                        <Select
                            value={form.data.office_location_id}
                            onValueChange={(value) =>
                                form.setData('office_location_id', value)
                            }
                        >
                            <SelectTrigger id="shift-location">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ANY_LOCATION}>
                                    Semua lokasi aktif
                                </SelectItem>
                                {locations.map((location) => (
                                    <SelectItem
                                        key={location.id}
                                        value={location.id}
                                    >
                                        {location.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <InputError message={form.errors.office_location_id} />
                    </div>
                </form>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Batal
                    </Button>
                    <Button
                        type="submit"
                        form="shift-form"
                        disabled={form.processing}
                    >
                        Simpan shift
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** Shift table (mockup LokasiShift "Shift"). */
export function ShiftsSection({ shifts, locations, shiftDefaults }: Props) {
    const [editing, setEditing] = useState<AdminShift | null>(null);
    const [open, setOpen] = useState(false);
    const [dialogKey, setDialogKey] = useState(0);

    const openDialog = (shift: AdminShift | null) => {
        setEditing(shift);
        setDialogKey((key) => key + 1);
        setOpen(true);
    };

    const remove = (shift: AdminShift) => {
        if (window.confirm(`Hapus shift ${shift.name}?`)) {
            router.delete(shiftRoutes.destroy.url(shift.id), {
                preserveScroll: true,
            });
        }
    };

    return (
        <SectionCard
            id="shift"
            title="Shift"
            description="Check-in setelah jam masuk + toleransi tercatat terlambat."
            actions={
                <>
                    <Button asChild variant="outline" size="sm">
                        <Link href={assignmentsIndex()} prefetch>
                            <Users aria-hidden />
                            Atur penugasan
                        </Link>
                    </Button>
                    <Button size="sm" onClick={() => openDialog(null)}>
                        <Plus aria-hidden />
                        Tambah shift
                    </Button>
                </>
            }
        >
            {shifts.length === 0 ? (
                <div className="p-4">
                    <EmptyState
                        icon={Users}
                        title="Belum ada shift"
                        description="Tambah shift kerja, lalu atur penugasannya ke karyawan."
                    />
                </div>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow className="bg-surface-2 hover:bg-surface-2">
                            <TableHead className="pl-4 text-[13px] text-text-muted">
                                Nama
                            </TableHead>
                            <TableHead className="text-[13px] text-text-muted">
                                Jam kerja
                            </TableHead>
                            <TableHead className="text-[13px] text-text-muted">
                                Toleransi
                            </TableHead>
                            <TableHead className="text-[13px] text-text-muted">
                                Hari
                            </TableHead>
                            <TableHead className="text-[13px] text-text-muted">
                                Lokasi
                            </TableHead>
                            <TableHead className="text-right text-[13px] text-text-muted">
                                Karyawan
                            </TableHead>
                            <TableHead className="w-12 pr-4">
                                <span className="sr-only">Aksi</span>
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {shifts.map((shift) => (
                            <TableRow key={shift.id}>
                                <TableCell className="pl-4 text-[13px] font-medium text-text">
                                    {shift.name}
                                </TableCell>
                                <TableCell className="text-[13px]">
                                    <span className="font-mono text-text">
                                        {shift.hours}
                                    </span>
                                    {shift.crossesMidnight && (
                                        <span className="ml-2 rounded-md bg-info-soft px-2 py-0.5 text-xs text-info">
                                            lintas tengah malam
                                        </span>
                                    )}
                                </TableCell>
                                <TableCell className="text-[13px] text-text">
                                    {shift.lateToleranceMin} menit
                                </TableCell>
                                <TableCell className="text-[13px] text-text">
                                    {shift.daysLabel ?? '–'}
                                </TableCell>
                                <TableCell className="text-[13px] text-text">
                                    {shift.locationName ?? 'Semua lokasi'}
                                </TableCell>
                                <TableCell className="text-right text-[13px] text-text tnum">
                                    {shift.employeesCount}
                                </TableCell>
                                <TableCell className="pr-4">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="size-8"
                                                aria-label={`Aksi shift ${shift.name}`}
                                            >
                                                <MoreHorizontal aria-hidden />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem
                                                onSelect={() =>
                                                    openDialog(shift)
                                                }
                                            >
                                                Ubah
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                className="text-danger"
                                                onSelect={() => remove(shift)}
                                            >
                                                Hapus
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
            <p className="border-t border-border px-4 py-2.5 text-xs text-text-muted">
                Shift lintas tengah malam dicatat pada tanggal check-in.
                Karyawan tanpa penugasan tidak terjadwal.
            </p>
            <ShiftDialog
                key={dialogKey}
                shift={editing}
                open={open}
                onClose={() => setOpen(false)}
                locations={locations}
                defaults={shiftDefaults}
            />
        </SectionCard>
    );
}
