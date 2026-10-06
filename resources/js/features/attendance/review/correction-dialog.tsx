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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import correctionRoutes from '@/routes/attendance/corrections';

export type CorrectionTarget = {
    userId: string;
    name: string;
    workDate: string;
    /** "HH:MM" office time, prefilled when known. */
    checkIn?: string | null;
    checkOut?: string | null;
};

type Props = {
    target: CorrectionTarget | null;
    today: string;
    /** Props to reload after saving. */
    reload: string[];
    onClose: () => void;
};

/**
 * HR manual correction (method manual): times in office time, reason
 * mandatory, written to the audit log.
 */
export function CorrectionDialog({ target, today, reload, onClose }: Props) {
    const form = useForm({
        user_id: target?.userId ?? '',
        work_date: target?.workDate ?? today,
        check_in: target?.checkIn ?? '',
        check_out: target?.checkOut ?? '',
        reason: '',
    });

    return (
        <Dialog
            open={target !== null}
            onOpenChange={(next) => !next && onClose()}
        >
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Koreksi absensi · {target?.name}</DialogTitle>
                    <DialogDescription>
                        Tercatat sebagai metode manual atas nama Anda, beserta
                        alasannya, di audit log.
                    </DialogDescription>
                </DialogHeader>
                <form
                    id="correction-form"
                    className="grid gap-3"
                    onSubmit={(event) => {
                        event.preventDefault();
                        form.transform((data) => ({
                            ...data,
                            check_in: data.check_in || null,
                            check_out: data.check_out || null,
                        }));
                        form.post(correctionRoutes.store.url(), {
                            preserveScroll: true,
                            only: reload,
                            onSuccess: () => {
                                form.reset();
                                onClose();
                            },
                        });
                    }}
                >
                    <div className="grid gap-1.5">
                        <Label htmlFor="correction-date">Tanggal kerja</Label>
                        <DateInput
                            id="correction-date"
                            max={today}
                            value={form.data.work_date}
                            onChange={(value) =>
                                form.setData('work_date', value)
                            }
                            required
                        />
                        <InputError message={form.errors.work_date} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-1.5">
                            <Label htmlFor="correction-in">Jam masuk</Label>
                            <Input
                                id="correction-in"
                                type="time"
                                value={form.data.check_in}
                                onChange={(event) =>
                                    form.setData('check_in', event.target.value)
                                }
                            />
                            <InputError message={form.errors.check_in} />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="correction-out">Jam pulang</Label>
                            <Input
                                id="correction-out"
                                type="time"
                                value={form.data.check_out}
                                onChange={(event) =>
                                    form.setData(
                                        'check_out',
                                        event.target.value,
                                    )
                                }
                            />
                            <InputError message={form.errors.check_out} />
                        </div>
                    </div>
                    <p className="text-meta text-text-muted">
                        Kosongkan jam yang tidak diubah. Jam pulang yang lebih
                        awal dari jam masuk dihitung esok hari (shift malam).
                    </p>
                    <div className="grid gap-1.5">
                        <Label htmlFor="correction-reason">Alasan</Label>
                        <Textarea
                            id="correction-reason"
                            value={form.data.reason}
                            onChange={(event) =>
                                form.setData('reason', event.target.value)
                            }
                            placeholder="Mis. lupa check-out, dikonfirmasi atasan"
                            maxLength={500}
                            required
                        />
                        <InputError message={form.errors.reason} />
                    </div>
                    <InputError message={form.errors.user_id} />
                </form>
                <DialogFooter>
                    <Button type="button" variant="quiet" onClick={onClose}>
                        Batal
                    </Button>
                    <Button
                        type="submit"
                        form="correction-form"
                        disabled={form.processing}
                    >
                        Simpan koreksi
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
