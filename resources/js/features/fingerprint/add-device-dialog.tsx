import { Check, Copy } from 'lucide-react';
import type { FormEvent } from 'react';
import { useEffect, useId, useState } from 'react';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Field } from '@/features/okr/parts';
import { useClipboard } from '@/hooks/use-clipboard';
import { cn, focusRing } from '@/lib/utils';
import type { DeviceDraft, DeviceDraftErrors } from './lib';
import { admsSettings, TIMEZONES, validateDeviceDraft } from './lib';
import type { FingerprintDevice, OfficeLocationRef } from './types';

const EMPTY: DeviceDraft = {
    serial_number: '',
    name: '',
    location_id: '',
    timezone: 'Asia/Jakarta',
};

/** "Tambah mesin" (desktop): SN, name, location, timezone → ADMS setup steps. */
export function AddDeviceDialog({
    open,
    onOpenChange,
    devices,
    locations,
    processing,
    onAdd,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    devices: FingerprintDevice[];
    locations: OfficeLocationRef[];
    processing: boolean;
    onAdd: (draft: DeviceDraft) => Promise<FingerprintDevice | null>;
}) {
    const id = useId();
    const [draft, setDraft] = useState<DeviceDraft>(EMPTY);
    const [errors, setErrors] = useState<DeviceDraftErrors>({});
    const [added, setAdded] = useState<FingerprintDevice | null>(null);

    useEffect(() => {
        if (open) {
            setDraft(EMPTY);
            setErrors({});
            setAdded(null);
        }
    }, [open]);

    const set = <K extends keyof DeviceDraft>(
        key: K,
        value: DeviceDraft[K],
    ) => {
        setDraft((current) => ({ ...current, [key]: value }));
        setErrors((current) => ({ ...current, [key]: undefined }));
    };

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const found = validateDeviceDraft(draft, devices);

        setErrors(found);

        if (Object.keys(found).length > 0) {
            document.getElementById(`${id}-${Object.keys(found)[0]}`)?.focus();

            return;
        }

        setAdded(await onAdd(draft));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>
                        {added
                            ? 'Atur mesin untuk ADMS'
                            : 'Tambah mesin absensi'}
                    </DialogTitle>
                    <DialogDescription>
                        {added
                            ? `${added.name} terdaftar. Masukkan pengaturan berikut di mesin agar log terkirim otomatis.`
                            : 'Mesin ZKTeco yang mendukung push ADMS (iclock). Nomor seri ada di label belakang mesin atau Menu › Info sistem.'}
                    </DialogDescription>
                </DialogHeader>

                {added ? (
                    <AdmsInstructions serial={added.serial_number} />
                ) : (
                    <form
                        id={`${id}-form`}
                        noValidate
                        onSubmit={submit}
                        className="flex flex-col gap-4"
                    >
                        <Field
                            id={`${id}-serial_number`}
                            label="Nomor seri (SN)"
                            error={errors.serial_number}
                        >
                            <Input
                                id={`${id}-serial_number`}
                                value={draft.serial_number}
                                autoComplete="off"
                                spellCheck={false}
                                className="font-mono uppercase"
                                placeholder="Mis. CQZ7232460999"
                                aria-invalid={
                                    errors.serial_number ? true : undefined
                                }
                                aria-describedby={
                                    errors.serial_number
                                        ? `${id}-serial_number-hint`
                                        : undefined
                                }
                                onChange={(event) =>
                                    set('serial_number', event.target.value)
                                }
                            />
                        </Field>
                        <Field
                            id={`${id}-name`}
                            label="Nama mesin"
                            error={errors.name}
                        >
                            <Input
                                id={`${id}-name`}
                                value={draft.name}
                                maxLength={80}
                                placeholder="Lobi Kantor Pusat"
                                aria-invalid={errors.name ? true : undefined}
                                aria-describedby={
                                    errors.name ? `${id}-name-hint` : undefined
                                }
                                onChange={(event) =>
                                    set('name', event.target.value)
                                }
                            />
                        </Field>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field
                                id={`${id}-location_id`}
                                label="Lokasi kantor"
                                error={errors.location_id}
                            >
                                <Select
                                    value={draft.location_id}
                                    onValueChange={(value) =>
                                        set('location_id', value)
                                    }
                                >
                                    <SelectTrigger
                                        id={`${id}-location_id`}
                                        className="w-full"
                                        aria-invalid={
                                            errors.location_id
                                                ? true
                                                : undefined
                                        }
                                    >
                                        <SelectValue placeholder="Pilih lokasi" />
                                    </SelectTrigger>
                                    <SelectContent>
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
                            </Field>
                            <Field
                                id={`${id}-timezone`}
                                label="Zona waktu mesin"
                                hint="Jam log dibaca di zona ini"
                            >
                                <Select
                                    value={draft.timezone}
                                    onValueChange={(value) =>
                                        set(
                                            'timezone',
                                            value as DeviceDraft['timezone'],
                                        )
                                    }
                                >
                                    <SelectTrigger
                                        id={`${id}-timezone`}
                                        className="w-full"
                                        aria-describedby={`${id}-timezone-hint`}
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {TIMEZONES.map((zone) => (
                                            <SelectItem
                                                key={zone.value}
                                                value={zone.value}
                                            >
                                                {zone.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>
                        </div>
                    </form>
                )}

                <DialogFooter>
                    {added ? (
                        <Button onClick={() => onOpenChange(false)}>
                            Selesai
                        </Button>
                    ) : (
                        <>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                            >
                                Batal
                            </Button>
                            <Button
                                type="submit"
                                form={`${id}-form`}
                                disabled={processing}
                            >
                                {processing && <Spinner />}
                                Tambah mesin
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** Values to type on the device (Menu › Komunikasi › Pengaturan Cloud Server). */
export function AdmsInstructions({ serial }: { serial?: string }) {
    const settings = admsSettings(
        typeof window === 'undefined'
            ? 'https://ruangkerja.test'
            : window.location.origin,
    );
    const rows = [
        { label: 'Alamat server', value: settings.server },
        { label: 'Port server', value: settings.port },
        { label: 'URL push (iclock)', value: settings.endpoint },
    ];

    return (
        <div className="flex flex-col gap-4">
            <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[15px] leading-[22px] text-text-muted marker:font-bold marker:text-text">
                <li>
                    Di mesin buka{' '}
                    <b className="text-text">
                        Menu › Komunikasi › Pengaturan Cloud Server
                    </b>
                    .
                </li>
                <li>
                    Aktifkan <b className="text-text">Nama domain</b>
                    {settings.https && (
                        <>
                            {' '}
                            dan <b className="text-text">HTTPS</b>
                        </>
                    )}
                    , lalu isi nilai di bawah.
                </li>
                <li>
                    Simpan dan mulai ulang mesin. Status berubah menjadi Online
                    setelah push pertama.
                </li>
            </ol>
            <dl className="flex flex-col divide-y divide-divider rounded-lg border border-border bg-surface">
                {rows.map((row) => (
                    <CopyRow
                        key={row.label}
                        label={row.label}
                        value={row.value}
                    />
                ))}
                {serial && (
                    <CopyRow label="Nomor seri terdaftar" value={serial} />
                )}
            </dl>
        </div>
    );
}

function CopyRow({ label, value }: { label: string; value: string }) {
    const [, copy] = useClipboard();
    const [copied, setCopied] = useState(false);

    return (
        <div className="flex flex-col px-4 py-2">
            <dt className="text-[13px] font-semibold text-text-muted">
                {label}
            </dt>
            <dd className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate font-mono text-[15px] font-semibold text-text">
                    {value}
                </span>
                <button
                    type="button"
                    aria-label={`Salin ${label}`}
                    onClick={async () => {
                        setCopied(await copy(value));
                        window.setTimeout(() => setCopied(false), 1600);
                    }}
                    className={cn(
                        '-my-1 flex size-11 shrink-0 items-center justify-center rounded-control text-text-muted transition-colors duration-120 ease-brand hover:bg-surface-2 hover:text-text',
                        focusRing,
                    )}
                >
                    {copied ? (
                        <Check aria-hidden className="size-5 text-success" />
                    ) : (
                        <Copy aria-hidden className="size-5" />
                    )}
                </button>
            </dd>
        </div>
    );
}
