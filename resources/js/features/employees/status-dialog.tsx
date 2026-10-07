import { useForm } from '@inertiajs/react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { deactivate, reactivate } from '@/routes/admin/employees';

export type StatusTarget = {
    id: string;
    name: string;
    status: 'active' | 'inactive' | 'resigned';
    managerName?: string | null;
    directReports?: number;
};

/**
 * Deactivate (inactive / resigned + reason) or reactivate an employee.
 */
export function StatusDialog({
    target,
    onClose,
    onDone,
}: {
    target: StatusTarget | null;
    onClose: () => void;
    onDone?: () => void;
}) {
    return (
        <Dialog
            open={target !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent className="sm:max-w-md">
                {target &&
                    (target.status === 'active' ? (
                        <DeactivateForm
                            key={target.id}
                            target={target}
                            onClose={onClose}
                            onDone={onDone}
                        />
                    ) : (
                        <ReactivateForm
                            key={target.id}
                            target={target}
                            onClose={onClose}
                            onDone={onDone}
                        />
                    ))}
            </DialogContent>
        </Dialog>
    );
}

function DeactivateForm({
    target,
    onClose,
    onDone,
}: {
    target: StatusTarget;
    onClose: () => void;
    onDone?: () => void;
}) {
    const form = useForm({
        status: 'inactive' as 'inactive' | 'resigned',
        reason: '',
        reassign_reports: true,
    });
    const reports = target.directReports;

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                form.post(deactivate.url(target.id), {
                    preserveScroll: true,
                    onSuccess: () => {
                        onClose();
                        onDone?.();
                    },
                });
            }}
            className="space-y-4"
        >
            <DialogHeader>
                <DialogTitle>Nonaktifkan {target.name}?</DialogTitle>
                <DialogDescription>
                    Akun langsung keluar dan tidak bisa masuk lagi. Riwayat
                    absensi, pengajuan, dan tugasnya tetap tersimpan.
                </DialogDescription>
            </DialogHeader>

            <fieldset className="space-y-2">
                <legend className="mb-2 text-[15px] font-medium">Status</legend>
                <div className="grid grid-cols-2 gap-2">
                    {(
                        [
                            ['inactive', 'Nonaktif'],
                            ['resigned', 'Mengundurkan diri'],
                        ] as const
                    ).map(([value, label]) => (
                        <label
                            key={value}
                            className={cn(
                                'flex h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-[15px]',
                                form.data.status === value
                                    ? 'border-link bg-link-soft text-text'
                                    : 'border-border text-text-muted',
                            )}
                        >
                            <input
                                type="radio"
                                name="status"
                                value={value}
                                checked={form.data.status === value}
                                onChange={() => form.setData('status', value)}
                                className="accent-primary"
                            />
                            {label}
                        </label>
                    ))}
                </div>
                <InputError message={form.errors.status} />
            </fieldset>

            <div className="space-y-2">
                <Label htmlFor="deactivate-reason">Alasan</Label>
                <Textarea
                    id="deactivate-reason"
                    value={form.data.reason}
                    onChange={(event) =>
                        form.setData('reason', event.target.value)
                    }
                    placeholder="Mis. kontrak berakhir 30 September"
                    maxLength={500}
                    required
                    className="min-h-24"
                    aria-invalid={Boolean(form.errors.reason) || undefined}
                />
                <p className="text-meta text-text-muted">
                    Tercatat di audit log.
                </p>
                <InputError message={form.errors.reason} />
            </div>

            {reports !== 0 && (
                <label className="flex items-start gap-2 text-[15px]">
                    <Checkbox
                        checked={form.data.reassign_reports}
                        onCheckedChange={(checked) =>
                            form.setData('reassign_reports', checked === true)
                        }
                        className="mt-0.5"
                    />
                    <span>
                        {reports === undefined
                            ? 'Pindahkan bawahan langsung (bila ada)'
                            : `Pindahkan ${reports} bawahan langsung`}{' '}
                        ke{' '}
                        {target.managerName
                            ? target.managerName
                            : 'tanpa atasan'}{' '}
                        agar persetujuan tetap berjalan.
                    </span>
                </label>
            )}

            <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>
                    Batal
                </Button>
                <Button
                    type="submit"
                    variant="destructive"
                    disabled={form.processing}
                >
                    Nonaktifkan
                </Button>
            </DialogFooter>
        </form>
    );
}

function ReactivateForm({
    target,
    onClose,
    onDone,
}: {
    target: StatusTarget;
    onClose: () => void;
    onDone?: () => void;
}) {
    const form = useForm({ reason: '' });

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                form.post(reactivate.url(target.id), {
                    preserveScroll: true,
                    onSuccess: () => {
                        onClose();
                        onDone?.();
                    },
                });
            }}
            className="space-y-4"
        >
            <DialogHeader>
                <DialogTitle>Aktifkan kembali {target.name}?</DialogTitle>
                <DialogDescription>
                    Karyawan bisa masuk lagi dengan email dan kata sandinya.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
                <Label htmlFor="reactivate-reason">Catatan (opsional)</Label>
                <Textarea
                    id="reactivate-reason"
                    value={form.data.reason}
                    onChange={(event) =>
                        form.setData('reason', event.target.value)
                    }
                    maxLength={500}
                    className="min-h-24"
                />
                <InputError message={form.errors.reason} />
            </div>
            <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>
                    Batal
                </Button>
                <Button type="submit" disabled={form.processing}>
                    Aktifkan kembali
                </Button>
            </DialogFooter>
        </form>
    );
}
