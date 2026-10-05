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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { selectClass } from '@/features/requests/form-fields';
import { store, update } from '@/routes/admin/leave-types';
import type { RequestCategory } from '@/types/requests';
import type { AdminFlow, AdminLeaveType, AdminOptions } from './types';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    type: AdminLeaveType | null;
    flows: AdminFlow[];
    options: AdminOptions;
};

const numberOrNull = (value: string): number | null =>
    value === '' ? null : Number(value);

/** Create / edit a leave type (jenis pengajuan) and its quota rules. */
export function LeaveTypeDialog({
    open,
    onOpenChange,
    type,
    flows,
    options,
}: Props) {
    const form = useForm({
        code: type?.code ?? '',
        name: type?.name ?? '',
        category: (type?.category ?? 'leave') as RequestCategory,
        description: type?.description ?? '',
        annual_quota_days: type?.annual_quota_days ?? (null as number | null),
        carry_over_max_days:
            type?.carry_over_max_days ?? (null as number | null),
        requires_attachment_after_days:
            type?.requires_attachment_after_days ?? (null as number | null),
        max_backdate_days: type?.max_backdate_days ?? (null as number | null),
        min_service_months: type?.min_service_months ?? (null as number | null),
        allow_half_day: type?.allow_half_day ?? false,
        is_paid: type?.is_paid ?? true,
        is_active: type?.is_active ?? true,
        approval_flow_id: type?.approval_flow_id ?? '',
    });
    const { data, setData, errors } = form;

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        form.transform((values) => ({
            ...values,
            approval_flow_id: values.approval_flow_id || null,
        }));
        const done = {
            preserveScroll: true,
            onSuccess: () => onOpenChange(false),
        };

        if (type) {
            form.put(update.url({ leaveType: type.id }), done);
        } else {
            form.post(store.url(), done);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>
                        {type ? `Ubah ${type.name}` : 'Jenis pengajuan baru'}
                    </DialogTitle>
                    <DialogDescription>
                        Kode dipakai sebagai awalan nomor, mis.
                        CUT-2026-10-0001.
                    </DialogDescription>
                </DialogHeader>
                <form
                    id="leave-type-form"
                    onSubmit={submit}
                    className="grid gap-4 sm:grid-cols-2"
                >
                    <div className="grid gap-2">
                        <Label htmlFor="lt-name">Nama</Label>
                        <Input
                            id="lt-name"
                            value={data.name}
                            maxLength={120}
                            onChange={(e) => setData('name', e.target.value)}
                        />
                        <InputError message={errors.name} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="lt-code">Kode</Label>
                        <Input
                            id="lt-code"
                            className="font-mono uppercase"
                            value={data.code}
                            maxLength={10}
                            onChange={(e) =>
                                setData('code', e.target.value.toUpperCase())
                            }
                        />
                        <InputError message={errors.code} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="lt-category">Kategori</Label>
                        <select
                            id="lt-category"
                            className={selectClass}
                            value={data.category}
                            disabled={type !== null}
                            onChange={(e) =>
                                setData(
                                    'category',
                                    e.target.value as RequestCategory,
                                )
                            }
                        >
                            {options.categories.map((category) => (
                                <option
                                    key={category.value}
                                    value={category.value}
                                >
                                    {category.label}
                                </option>
                            ))}
                        </select>
                        <InputError message={errors.category} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="lt-flow">Alur persetujuan</Label>
                        <select
                            id="lt-flow"
                            className={selectClass}
                            value={data.approval_flow_id}
                            onChange={(e) =>
                                setData('approval_flow_id', e.target.value)
                            }
                        >
                            <option value="">Default perusahaan</option>
                            {flows.map((flow) => (
                                <option key={flow.id} value={flow.id}>
                                    {flow.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {data.category === 'leave' && (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="lt-quota">
                                    Jatah per tahun (hari)
                                </Label>
                                <Input
                                    id="lt-quota"
                                    type="number"
                                    min={0}
                                    step={0.5}
                                    placeholder="Kosong = tanpa saldo"
                                    value={data.annual_quota_days ?? ''}
                                    onChange={(e) =>
                                        setData(
                                            'annual_quota_days',
                                            numberOrNull(e.target.value),
                                        )
                                    }
                                />
                                <InputError
                                    message={errors.annual_quota_days}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="lt-carry">
                                    Maks. bawaan ke tahun berikut
                                </Label>
                                <Input
                                    id="lt-carry"
                                    type="number"
                                    min={0}
                                    step={0.5}
                                    placeholder="Kosong = tidak dibawa"
                                    value={data.carry_over_max_days ?? ''}
                                    onChange={(e) =>
                                        setData(
                                            'carry_over_max_days',
                                            numberOrNull(e.target.value),
                                        )
                                    }
                                />
                                <InputError
                                    message={errors.carry_over_max_days}
                                />
                            </div>
                        </>
                    )}

                    <div className="grid gap-2">
                        <Label htmlFor="lt-attachment">
                            Lampiran wajib bila lebih dari (hari)
                        </Label>
                        <Input
                            id="lt-attachment"
                            type="number"
                            min={0}
                            placeholder="Kosong = tidak wajib; 0 = selalu"
                            value={data.requires_attachment_after_days ?? ''}
                            onChange={(e) =>
                                setData(
                                    'requires_attachment_after_days',
                                    numberOrNull(e.target.value),
                                )
                            }
                        />
                        <InputError
                            message={errors.requires_attachment_after_days}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="lt-service">
                            Minimal masa kerja (bulan)
                        </Label>
                        <Input
                            id="lt-service"
                            type="number"
                            min={0}
                            placeholder="Kosong = semua karyawan"
                            value={data.min_service_months ?? ''}
                            onChange={(e) =>
                                setData(
                                    'min_service_months',
                                    numberOrNull(e.target.value),
                                )
                            }
                        />
                        <InputError message={errors.min_service_months} />
                    </div>
                    {data.category === 'correction' && (
                        <div className="grid gap-2">
                            <Label htmlFor="lt-backdate">
                                Maks. hari ke belakang
                            </Label>
                            <Input
                                id="lt-backdate"
                                type="number"
                                min={0}
                                value={data.max_backdate_days ?? ''}
                                onChange={(e) =>
                                    setData(
                                        'max_backdate_days',
                                        numberOrNull(e.target.value),
                                    )
                                }
                            />
                            <InputError message={errors.max_backdate_days} />
                        </div>
                    )}

                    <div className="grid gap-2 sm:col-span-2">
                        <Label htmlFor="lt-description">Keterangan</Label>
                        <Textarea
                            id="lt-description"
                            rows={2}
                            maxLength={255}
                            value={data.description}
                            onChange={(e) =>
                                setData('description', e.target.value)
                            }
                        />
                    </div>

                    <div className="grid gap-3 sm:col-span-2">
                        {(data.category === 'leave' ||
                            data.category === 'permit') && (
                            <label className="flex items-center justify-between gap-3 text-sm">
                                Boleh setengah hari
                                <Switch
                                    checked={data.allow_half_day}
                                    onCheckedChange={(value) =>
                                        setData('allow_half_day', value)
                                    }
                                />
                            </label>
                        )}
                        <label className="flex items-center justify-between gap-3 text-sm">
                            Dibayar
                            <Switch
                                checked={data.is_paid}
                                onCheckedChange={(value) =>
                                    setData('is_paid', value)
                                }
                            />
                        </label>
                        <label className="flex items-center justify-between gap-3 text-sm">
                            Aktif (tampil di form pengajuan)
                            <Switch
                                checked={data.is_active}
                                onCheckedChange={(value) =>
                                    setData('is_active', value)
                                }
                            />
                        </label>
                    </div>
                </form>
                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Batal
                    </Button>
                    <Button
                        type="submit"
                        form="leave-type-form"
                        disabled={form.processing}
                    >
                        Simpan
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
