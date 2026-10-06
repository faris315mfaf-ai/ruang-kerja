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
import { NativeSelect } from '@/features/admin/native-select';
import { ProvisionalBadge } from '@/features/requests/form-fields';
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
        counts_calendar_days: type?.counts_calendar_days ?? false,
        max_days_per_request:
            type?.max_days_per_request ?? (null as number | null),
        is_paid: type?.is_paid ?? true,
        is_active: type?.is_active ?? true,
        // Lock (keputusan pemilik 6 Okt 2026): cuti & lembur wait for the SOP.
        is_locked: (type?.locked_reason ?? null) !== null,
        locked_reason: type?.locked_reason ?? '',
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
                    {type?.is_provisional_default && (
                        <p className="flex flex-wrap items-center gap-2 text-meta text-text-muted">
                            <ProvisionalBadge />
                            Aturan bawaan sistem. Tinjau lalu simpan untuk
                            menetapkannya sebagai aturan perusahaan.
                        </p>
                    )}
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
                        <NativeSelect
                            id="lt-category"
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
                        </NativeSelect>
                        <InputError message={errors.category} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="lt-flow">Alur persetujuan</Label>
                        <NativeSelect
                            id="lt-flow"
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
                        </NativeSelect>
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
                    {data.category !== 'overtime' &&
                        data.category !== 'correction' && (
                            <div className="grid gap-2">
                                <Label htmlFor="lt-max-days">
                                    Maks. per pengajuan (hari)
                                </Label>
                                <Input
                                    id="lt-max-days"
                                    type="number"
                                    min={0.5}
                                    step={0.5}
                                    placeholder="Kosong = tanpa batas"
                                    value={data.max_days_per_request ?? ''}
                                    onChange={(e) =>
                                        setData(
                                            'max_days_per_request',
                                            numberOrNull(e.target.value),
                                        )
                                    }
                                />
                                <InputError
                                    message={errors.max_days_per_request}
                                />
                            </div>
                        )}
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

                    <div className="divide-y divide-divider rounded-lg border border-border sm:col-span-2">
                        {(data.category === 'leave' ||
                            data.category === 'permit') && (
                            <label className="flex min-h-13 items-center justify-between gap-3 px-4 py-2 text-[15px] font-semibold">
                                Boleh setengah hari
                                <Switch
                                    checked={data.allow_half_day}
                                    onCheckedChange={(value) =>
                                        setData('allow_half_day', value)
                                    }
                                />
                            </label>
                        )}
                        {data.category === 'leave' && (
                            <label className="flex min-h-13 items-center justify-between gap-3 px-4 py-2 text-[15px] font-semibold">
                                Dihitung hari kalender (bukan hari kerja)
                                <Switch
                                    checked={data.counts_calendar_days}
                                    onCheckedChange={(value) =>
                                        setData('counts_calendar_days', value)
                                    }
                                />
                            </label>
                        )}
                        <label className="flex min-h-13 items-center justify-between gap-3 px-4 py-2 text-[15px] font-semibold">
                            Dibayar
                            <Switch
                                checked={data.is_paid}
                                onCheckedChange={(value) =>
                                    setData('is_paid', value)
                                }
                            />
                        </label>
                        <label className="flex min-h-13 items-center justify-between gap-3 px-4 py-2 text-[15px] font-semibold">
                            Aktif (tampil di form pengajuan)
                            <Switch
                                checked={data.is_active}
                                onCheckedChange={(value) =>
                                    setData('is_active', value)
                                }
                            />
                        </label>
                        <div className="flex flex-col gap-2 px-4 py-2">
                            <label className="flex min-h-11 items-center justify-between gap-3 text-[15px] font-semibold">
                                <span className="flex flex-col">
                                    Kunci (tampil, tetapi belum bisa diajukan)
                                    <span className="text-meta font-normal text-text-muted">
                                        Pengajuan yang sudah dikirim atau
                                        disetujui tidak berubah.
                                    </span>
                                </span>
                                <Switch
                                    checked={data.is_locked}
                                    onCheckedChange={(value) =>
                                        setData('is_locked', value)
                                    }
                                />
                            </label>
                            {data.is_locked && (
                                <div className="grid gap-1.5 pb-1">
                                    <Label htmlFor="locked_reason">
                                        Alasan kunci
                                    </Label>
                                    <Input
                                        id="locked_reason"
                                        maxLength={200}
                                        value={data.locked_reason}
                                        placeholder="Dikunci sampai SOP cuti/lembur ditetapkan."
                                        onChange={(e) =>
                                            setData(
                                                'locked_reason',
                                                e.target.value,
                                            )
                                        }
                                    />
                                    <InputError
                                        message={errors.locked_reason}
                                    />
                                </div>
                            )}
                        </div>
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
