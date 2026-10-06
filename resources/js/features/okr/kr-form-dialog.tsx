import { Trash2 } from 'lucide-react';
import type { FormEvent } from 'react';
import { useEffect, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import type { FormErrors } from './api';
import type { KrDraft, KrDraftErrors } from './lib';
import { draftFromKr, validateKrDraft } from './lib';
import { Field, formIdFor, ResponsiveFormDialog } from './parts';
import type { KeyResult, KrUnit, PersonRef } from './types';

const UNITS: { value: KrUnit; label: string }[] = [
    { value: 'number', label: 'Angka' },
    { value: 'percent', label: 'Persen (%)' },
    { value: 'currency', label: 'Rupiah' },
    { value: 'days', label: 'Hari' },
];

/** Add / edit a key result (title, unit, start/target/current, weight, owner). */
export function KrFormDialog({
    open,
    onOpenChange,
    mobile,
    keyResult,
    defaultOwner,
    owners,
    processing,
    onSave,
    onDelete,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mobile: boolean;
    /** null = new key result. */
    keyResult: KeyResult | null;
    defaultOwner: string;
    /** Active employees and the head of the division. */
    owners: PersonRef[];
    processing: boolean;
    onSave: (
        draft: KrDraft,
        onErrors: (errors: FormErrors) => void,
    ) => Promise<boolean>;
    /** Present when the viewer may remove the key result. */
    onDelete?: () => Promise<boolean>;
}) {
    const id = useId();
    const [draft, setDraft] = useState<KrDraft>(() =>
        draftFromKr(keyResult, defaultOwner),
    );
    const [errors, setErrors] = useState<KrDraftErrors>({});
    const [confirmDelete, setConfirmDelete] = useState(false);
    // Keep a current owner who left the division selectable (shown as is).
    const ownerOptions =
        keyResult && !owners.some((owner) => owner.id === keyResult.owner.id)
            ? [...owners, keyResult.owner]
            : owners;
    const title = keyResult ? 'Ubah key result' : 'Tambah key result';

    useEffect(() => {
        if (open) {
            setDraft(draftFromKr(keyResult, defaultOwner));
            setErrors({});
            setConfirmDelete(false);
        }
    }, [open, keyResult, defaultOwner]);

    const set = <K extends keyof KrDraft>(key: K, value: KrDraft[K]) => {
        setDraft((current) => ({ ...current, [key]: value }));
        setErrors((current) => ({ ...current, [key]: undefined }));
    };

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const found = validateKrDraft(draft);

        setErrors(found);

        if (Object.keys(found).length > 0) {
            const first = Object.keys(found)[0];

            document.getElementById(`${id}-${first}`)?.focus();

            return;
        }

        const saved = await onSave(draft, (server) => {
            const mapped: KrDraftErrors = {};

            for (const [key, message] of Object.entries(server)) {
                if (key in draft) {
                    mapped[key as keyof KrDraft] = message;
                }
            }

            setErrors(mapped);
            const first = Object.keys(mapped)[0];

            if (first) {
                document.getElementById(`${id}-${first}`)?.focus();
            }
        });

        if (saved) {
            onOpenChange(false);
        }
    };

    const describedBy = (key: keyof KrDraft) =>
        errors[key] ? `${id}-${key}-hint` : undefined;

    const numberField = (
        key: 'start_value' | 'target_value' | 'current_value',
        label: string,
    ) => (
        <Field id={`${id}-${key}`} label={label} error={errors[key]}>
            <Input
                id={`${id}-${key}`}
                inputMode="decimal"
                autoComplete="off"
                value={draft[key]}
                aria-invalid={errors[key] ? true : undefined}
                aria-describedby={describedBy(key)}
                onChange={(event) => set(key, event.target.value)}
            />
        </Field>
    );

    return (
        <ResponsiveFormDialog
            open={open}
            onOpenChange={onOpenChange}
            mobile={mobile}
            title={title}
            description="Hasil terukur yang menandai objective tercapai. Desimal memakai koma."
            onSubmit={submit}
            actions={
                <>
                    {keyResult && onDelete && (
                        <Button
                            type="button"
                            variant={confirmDelete ? 'destructive' : 'ghost'}
                            className="sm:mr-auto"
                            disabled={processing}
                            onClick={async () => {
                                if (!confirmDelete) {
                                    setConfirmDelete(true);

                                    return;
                                }

                                if (await onDelete()) {
                                    onOpenChange(false);
                                }
                            }}
                        >
                            <Trash2 aria-hidden />
                            {confirmDelete ? 'Ya, hapus' : 'Hapus'}
                        </Button>
                    )}
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Batal
                    </Button>
                    <Button
                        type="submit"
                        form={formIdFor(title)}
                        disabled={processing}
                    >
                        {processing && <Spinner />}
                        {keyResult ? 'Simpan perubahan' : 'Tambah'}
                    </Button>
                </>
            }
        >
            <Field id={`${id}-title`} label="Key result" error={errors.title}>
                <Input
                    id={`${id}-title`}
                    value={draft.title}
                    maxLength={160}
                    placeholder="Mis. Skenario UAT lulus sebelum go-live"
                    aria-invalid={errors.title ? true : undefined}
                    aria-describedby={describedBy('title')}
                    onChange={(event) => set('title', event.target.value)}
                />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
                <Field id={`${id}-unit`} label="Satuan">
                    <Select
                        value={draft.unit}
                        onValueChange={(value) => set('unit', value as KrUnit)}
                    >
                        <SelectTrigger id={`${id}-unit`} className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {UNITS.map((unit) => (
                                <SelectItem key={unit.value} value={unit.value}>
                                    {unit.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>
                {draft.unit === 'number' && (
                    <Field
                        id={`${id}-unit_label`}
                        label="Nama satuan"
                        hint="Mis. skenario, tiket, unit"
                    >
                        <Input
                            id={`${id}-unit_label`}
                            value={draft.unit_label}
                            maxLength={20}
                            aria-describedby={`${id}-unit_label-hint`}
                            onChange={(event) =>
                                set('unit_label', event.target.value)
                            }
                        />
                    </Field>
                )}
            </div>

            <div className="grid grid-cols-3 gap-3">
                {numberField('start_value', 'Awal')}
                {numberField('target_value', 'Target')}
                {numberField('current_value', 'Saat ini')}
            </div>

            <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
                <Field id={`${id}-weight`} label="Bobot" error={errors.weight}>
                    <Input
                        id={`${id}-weight`}
                        inputMode="numeric"
                        value={draft.weight}
                        aria-invalid={errors.weight ? true : undefined}
                        aria-describedby={describedBy('weight')}
                        onChange={(event) => set('weight', event.target.value)}
                    />
                </Field>
                <Field
                    id={`${id}-owner_id`}
                    label="Pemilik"
                    error={errors.owner_id}
                >
                    <Select
                        value={draft.owner_id}
                        onValueChange={(value) => set('owner_id', value)}
                    >
                        <SelectTrigger
                            id={`${id}-owner_id`}
                            className="w-full"
                            aria-invalid={errors.owner_id ? true : undefined}
                        >
                            <SelectValue placeholder="Pilih pemilik" />
                        </SelectTrigger>
                        <SelectContent>
                            {ownerOptions.map((owner) => (
                                <SelectItem key={owner.id} value={owner.id}>
                                    {owner.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>
            </div>
        </ResponsiveFormDialog>
    );
}
