import { router, useForm } from '@inertiajs/react';
import {
    Check,
    KeyRound,
    Link2,
    MonitorSmartphone,
    Pencil,
    Plus,
    Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
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
import { useClipboard } from '@/hooks/use-clipboard';
import { formatDateTime, formatRelative } from '@/lib/format';
import { requestJson } from '@/lib/http';
import { NativeSelect } from '@/features/admin/native-select';
import kioskRoutes from '@/routes/admin/attendance/kiosks';
import type { AdminKiosk, AdminLocation } from './types';
import { SectionCard } from './section-card';

type Editing = AdminKiosk | 'new' | null;

/** Response of the activation endpoint, shown to HR once. */
type ActivationResponse = {
    url: string;
    /** Short single-use code typed on the device's /kiosk screen. */
    code: string;
    /** Absolute URL of the unpaired kiosk screen (/kiosk). */
    pairUrl: string;
    expiresAt: string;
};

type Activation = ActivationResponse & { kiosk: AdminKiosk };

/**
 * Admin › Kiosk QR (Sprint 3): lobby devices that show the dynamic QR. A
 * device is paired with a single-use link or the short code issued with it
 * (typed on the device's /kiosk screen); deactivating signs it out.
 */
export function KiosksSection({
    kiosks,
    locations,
}: {
    kiosks: AdminKiosk[];
    locations: AdminLocation[];
}) {
    const [editing, setEditing] = useState<Editing>(null);
    const [link, setLink] = useState<Activation | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const createLink = async (kiosk: AdminKiosk) => {
        setBusy(kiosk.id);
        setError(null);

        try {
            const data = await requestJson<ActivationResponse>(
                kioskRoutes.activation.url(kiosk.id),
                { method: 'POST' },
            );
            setLink({ kiosk, ...data });
            router.reload({ only: ['kiosks'] });
        } catch {
            setError('Tautan & kode aktivasi gagal dibuat. Coba lagi.');
        } finally {
            setBusy(null);
        }
    };

    const remove = (kiosk: AdminKiosk) => {
        if (
            window.confirm(
                `Hapus kiosk ${kiosk.name}? Perangkatnya langsung berhenti menampilkan QR.`,
            )
        ) {
            router.delete(kioskRoutes.destroy.url(kiosk.id), {
                preserveScroll: true,
                only: ['kiosks', 'flash'],
            });
        }
    };

    return (
        <SectionCard
            id="kiosk"
            title="Kiosk QR"
            description="Tablet/TV di lobi yang menampilkan QR absensi yang berganti tiap 30 detik."
            actions={
                <Button
                    type="button"
                    size="sm"
                    onClick={() => setEditing('new')}
                    disabled={locations.length === 0}
                >
                    <Plus aria-hidden />
                    Tambah kiosk
                </Button>
            }
        >
            {error && (
                <p className="border-b border-divider bg-danger-soft px-6 py-3 text-[15px] font-semibold text-danger md:px-7">
                    {error}
                </p>
            )}
            {kiosks.length === 0 ? (
                <EmptyState
                    icon={MonitorSmartphone}
                    title="Belum ada kiosk"
                    description="Tambahkan kiosk untuk lokasi yang ramai, lalu buka tautan aktivasinya (atau ketik kodenya) di perangkat lobi."
                    className="m-6"
                />
            ) : (
                <table className="w-full text-[15px]">
                    <thead className="border-b border-border bg-background text-[14px] text-text-muted">
                        <tr>
                            <th
                                scope="col"
                                className="h-11 py-2 pr-4 pl-6 text-left font-bold md:pl-7"
                            >
                                Kiosk
                            </th>
                            <th
                                scope="col"
                                className="h-11 px-4 py-2 text-left font-bold"
                            >
                                Lokasi
                            </th>
                            <th
                                scope="col"
                                className="h-11 px-4 py-2 text-left font-bold"
                            >
                                Status
                            </th>
                            <th
                                scope="col"
                                className="h-11 px-4 py-2 text-left font-bold"
                            >
                                Terakhir aktif
                            </th>
                            <th
                                scope="col"
                                className="h-11 py-2 pr-6 pl-4 text-right font-bold md:pr-7"
                            >
                                <span className="sr-only">Aksi</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-divider">
                        {kiosks.map((kiosk) => (
                            <tr key={kiosk.id}>
                                <td className="py-3.5 pr-4 pl-6 md:pl-7">
                                    <p className="font-semibold text-text">
                                        {kiosk.name}
                                    </p>
                                    <p className="font-mono text-meta text-text-muted">
                                        {kiosk.code}
                                    </p>
                                </td>
                                <td className="px-4 py-3.5 text-text">
                                    {kiosk.locationName}
                                </td>
                                <td className="px-4 py-3.5">
                                    <Badge
                                        variant="status"
                                        dot
                                        tone={
                                            !kiosk.isActive
                                                ? 'neutral'
                                                : kiosk.isPaired
                                                  ? 'success'
                                                  : 'warning'
                                        }
                                    >
                                        {!kiosk.isActive
                                            ? 'Nonaktif'
                                            : kiosk.isPaired
                                              ? 'Terpasang'
                                              : 'Belum dipasang'}
                                    </Badge>
                                    {kiosk.pendingActivationUntil && (
                                        <p className="mt-1 text-meta text-text-muted">
                                            Tautan &amp; kode berlaku s.d.{' '}
                                            {formatDateTime(
                                                kiosk.pendingActivationUntil,
                                            )}
                                        </p>
                                    )}
                                </td>
                                <td className="px-4 py-3.5 text-text-muted">
                                    {kiosk.lastSeenAt
                                        ? formatRelative(kiosk.lastSeenAt)
                                        : '–'}
                                </td>
                                <td className="py-3.5 pr-6 pl-4 md:pr-7">
                                    <div className="flex justify-end gap-1">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={
                                                !kiosk.isActive ||
                                                busy === kiosk.id
                                            }
                                            onClick={() =>
                                                void createLink(kiosk)
                                            }
                                        >
                                            <Link2 aria-hidden />
                                            Aktivasi perangkat
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon-sm"
                                            onClick={() => setEditing(kiosk)}
                                            aria-label={`Ubah ${kiosk.name}`}
                                        >
                                            <Pencil aria-hidden />
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon-sm"
                                            className="text-danger"
                                            onClick={() => remove(kiosk)}
                                            aria-label={`Hapus ${kiosk.name}`}
                                        >
                                            <Trash2 aria-hidden />
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
            <KioskDialog
                key={
                    editing === null
                        ? 'closed'
                        : editing === 'new'
                          ? 'new'
                          : editing.id
                }
                editing={editing}
                locations={locations}
                onClose={() => setEditing(null)}
            />
            <ActivationDialog link={link} onClose={() => setLink(null)} />
        </SectionCard>
    );
}

function KioskDialog({
    editing,
    locations,
    onClose,
}: {
    editing: Editing;
    locations: AdminLocation[];
    onClose: () => void;
}) {
    const current = editing === 'new' ? null : editing;
    const form = useForm({
        name: current?.name ?? 'Lobi',
        code: current?.code ?? '',
        office_location_id:
            current?.officeLocationId ??
            locations.find((location) => location.isActive)?.id ??
            '',
        is_active: current?.isActive ?? true,
    });

    const submit = () => {
        const options = { preserveScroll: true, onSuccess: onClose };

        if (current) {
            form.put(kioskRoutes.update.url(current.id), options);
        } else {
            form.post(kioskRoutes.store.url(), options);
        }
    };

    return (
        <Dialog
            open={editing !== null}
            onOpenChange={(next) => !next && onClose()}
        >
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {current
                            ? `Ubah kiosk ${current.name}`
                            : 'Tambah kiosk'}
                    </DialogTitle>
                    <DialogDescription>
                        Kode tampil di pojok kartu QR, mis. KP-LOBI.
                    </DialogDescription>
                </DialogHeader>
                <form
                    id="kiosk-form"
                    className="grid gap-3"
                    onSubmit={(event) => {
                        event.preventDefault();
                        submit();
                    }}
                >
                    <div className="grid gap-1.5">
                        <Label htmlFor="kiosk-name">Nama</Label>
                        <Input
                            id="kiosk-name"
                            value={form.data.name}
                            onChange={(event) =>
                                form.setData('name', event.target.value)
                            }
                            maxLength={80}
                            required
                        />
                        <InputError message={form.errors.name} />
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="kiosk-code">Kode</Label>
                        <Input
                            id="kiosk-code"
                            value={form.data.code}
                            onChange={(event) =>
                                form.setData(
                                    'code',
                                    event.target.value.toUpperCase(),
                                )
                            }
                            maxLength={20}
                            className="font-mono"
                            placeholder="KP-LOBI"
                            required
                        />
                        <InputError message={form.errors.code} />
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="kiosk-location">Lokasi</Label>
                        <NativeSelect
                            id="kiosk-location"
                            value={form.data.office_location_id}
                            onChange={(event) =>
                                form.setData(
                                    'office_location_id',
                                    event.target.value,
                                )
                            }
                        >
                            {locations.map((location) => (
                                <option key={location.id} value={location.id}>
                                    {location.name}
                                    {location.isActive ? '' : ' (nonaktif)'}
                                </option>
                            ))}
                        </NativeSelect>
                        <InputError message={form.errors.office_location_id} />
                    </div>
                    <label className="flex items-center justify-between gap-3 text-[15px] text-text">
                        Aktif
                        <Switch
                            checked={form.data.is_active}
                            onCheckedChange={(checked) =>
                                form.setData('is_active', checked)
                            }
                        />
                    </label>
                </form>
                <DialogFooter>
                    <Button type="button" variant="ghost" onClick={onClose}>
                        Batal
                    </Button>
                    <Button
                        type="submit"
                        form="kiosk-form"
                        disabled={form.processing}
                    >
                        Simpan
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function ActivationDialog({
    link,
    onClose,
}: {
    link: Activation | null;
    onClose: () => void;
}) {
    const [, copy] = useClipboard();
    const [copied, setCopied] = useState<'url' | 'code' | null>(null);

    const copyValue = (what: 'url' | 'code', value: string) =>
        void copy(value).then((ok) => setCopied(ok ? what : null));

    return (
        <Dialog
            open={link !== null}
            onOpenChange={(next) => {
                if (!next) {
                    setCopied(null);
                    onClose();
                }
            }}
        >
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>
                        Aktivasi perangkat · {link?.kiosk.name}
                    </DialogTitle>
                    <DialogDescription>
                        Pilih salah satu: buka tautan di perangkat kiosk, atau
                        buka {link?.pairUrl ?? '/kiosk'} di perangkat itu lalu
                        ketik kodenya. Sekali pakai (tautan atau kode), berlaku
                        sampai {link ? formatDateTime(link.expiresAt) : ''}.
                        Keduanya tidak ditampilkan lagi setelah dialog ditutup.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-1.5">
                    <p
                        id="kiosk-activation-code-label"
                        className="text-[15px] font-medium text-text"
                    >
                        Kode aktivasi
                    </p>
                    <div className="flex items-center gap-2">
                        <output
                            aria-labelledby="kiosk-activation-code-label"
                            className="flex h-14 flex-1 items-center justify-center rounded-lg border border-border bg-surface-2 font-mono text-[26px] font-semibold tracking-[0.2em] text-text select-all"
                        >
                            {link?.code}
                        </output>
                        <Button
                            type="button"
                            variant="outline"
                            className="h-14"
                            onClick={() => copyValue('code', link?.code ?? '')}
                        >
                            {copied === 'code' ? (
                                <Check className="text-success" aria-hidden />
                            ) : (
                                <KeyRound aria-hidden />
                            )}
                            {copied === 'code' ? 'Disalin' : 'Salin'}
                        </Button>
                    </div>
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="kiosk-activation-url">
                        Tautan aktivasi
                    </Label>
                    <div className="flex gap-2">
                        <Input
                            id="kiosk-activation-url"
                            readOnly
                            value={link?.url ?? ''}
                            className="font-mono text-meta"
                            onFocus={(event) => event.currentTarget.select()}
                        />
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => copyValue('url', link?.url ?? '')}
                        >
                            {copied === 'url' ? (
                                <Check className="text-success" aria-hidden />
                            ) : (
                                <Link2 aria-hidden />
                            )}
                            {copied === 'url' ? 'Disalin' : 'Salin'}
                        </Button>
                    </div>
                </div>
                <p className="text-meta text-text-muted">
                    Perangkat yang dipasangkan dikunci ke layar kiosk dan keluar
                    dari akun karyawan. Perangkat kiosk lama untuk kiosk ini
                    berhenti berfungsi. Memakai tautan membatalkan kode, dan
                    sebaliknya.
                </p>
            </DialogContent>
        </Dialog>
    );
}
