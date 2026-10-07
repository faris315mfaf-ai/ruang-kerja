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
import { Textarea } from '@/components/ui/textarea';
import type { FormErrors } from './api';
import { quarterLabel } from './lib';
import { Field, formIdFor, ResponsiveFormDialog } from './parts';
import type {
    DivisionRef,
    Objective,
    OwnerOption,
    PersonRef,
    QuarterKey,
} from './types';

export type ObjectiveDraft = {
    division_id: string;
    quarter: string;
    title: string;
    description: string;
    owner_id: string;
    status: 'draft' | 'active';
};

type DraftErrors = Partial<Record<keyof ObjectiveDraft, string>>;

/** Client-side checks mirroring ObjectiveRequest (Indonesian messages). */
export function validateObjectiveDraft(
    draft: ObjectiveDraft,
    creating: boolean,
): DraftErrors {
    const errors: DraftErrors = {};

    if (creating && !draft.division_id) {
        errors.division_id = 'Pilih divisi.';
    }

    if (draft.title.trim().length < 5) {
        errors.title = 'Tulis objective minimal 5 karakter.';
    } else if (draft.title.trim().length > 200) {
        errors.title = 'Maksimal 200 karakter.';
    }

    if (draft.description.length > 2000) {
        errors.description = 'Deskripsi maksimal 2.000 karakter.';
    }

    if (!draft.owner_id) {
        errors.owner_id = 'Pilih pemilik.';
    }

    return errors;
}

/** People offered for a division (create form: filtered by division). */
export function ownersFor(
    people: (PersonRef | OwnerOption)[],
    divisionId: string,
): PersonRef[] {
    return people.filter(
        (person) =>
            !('division_id' in person) || person.division_id === divisionId,
    );
}

/** Starting values of the form (edit: the objective; new: defaults). */
function draftFor(
    objective: Objective | null,
    divisions: DivisionRef[],
    defaultQuarter: QuarterKey,
    defaultDivision: string | undefined,
): ObjectiveDraft {
    if (objective) {
        return {
            division_id: objective.division.id,
            quarter: objective.quarter,
            title: objective.title,
            description: objective.description ?? '',
            owner_id: objective.owner.id,
            status: objective.status === 'draft' ? 'draft' : 'active',
        };
    }

    const division =
        divisions.find((item) => item.id === defaultDivision)?.id ??
        (divisions.length === 1 ? divisions[0].id : '');

    return {
        division_id: division,
        quarter: defaultQuarter,
        title: '',
        description: '',
        owner_id: '',
        status: 'active',
    };
}

/**
 * Create (division, quarter, title, description, owner, draft/active) or edit
 * an objective; the division is fixed once created.
 */
export function ObjectiveFormDialog({
    open,
    onOpenChange,
    mobile,
    objective,
    divisions,
    people,
    quarters,
    defaultQuarter,
    defaultDivision,
    processing,
    onSave,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mobile: boolean;
    /** null = new objective. */
    objective: Objective | null;
    /** Divisions to create in (create form only). */
    divisions: DivisionRef[];
    people: (PersonRef | OwnerOption)[];
    quarters: QuarterKey[];
    defaultQuarter: QuarterKey;
    defaultDivision?: string;
    processing: boolean;
    onSave: (
        draft: ObjectiveDraft,
        onErrors: (errors: FormErrors) => void,
    ) => Promise<boolean>;
}) {
    const id = useId();
    const creating = objective === null;
    const title = creating ? 'Objective baru' : 'Ubah objective';

    const [draft, setDraft] = useState<ObjectiveDraft>(() =>
        draftFor(objective, divisions, defaultQuarter, defaultDivision),
    );
    const [errors, setErrors] = useState<DraftErrors>({});

    useEffect(() => {
        if (open) {
            setDraft(
                draftFor(objective, divisions, defaultQuarter, defaultDivision),
            );
            setErrors({});
        }
    }, [open, objective, divisions, defaultQuarter, defaultDivision]);

    const owners = ownersFor(people, draft.division_id);
    const quarterOptions = quarters.includes(draft.quarter as QuarterKey)
        ? quarters
        : [...quarters, draft.quarter as QuarterKey];

    const set = <K extends keyof ObjectiveDraft>(
        key: K,
        value: ObjectiveDraft[K],
    ) => {
        setDraft((current) => ({
            ...current,
            [key]: value,
            // A new division needs an owner from that division.
            ...(key === 'division_id' ? { owner_id: '' } : {}),
        }));
        setErrors((current) => ({ ...current, [key]: undefined }));
    };

    const focusFirst = (found: DraftErrors) => {
        const first = Object.keys(found)[0];

        if (first) {
            document.getElementById(`${id}-${first}`)?.focus();
        }
    };

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const found = validateObjectiveDraft(draft, creating);

        setErrors(found);

        if (Object.keys(found).length > 0) {
            focusFirst(found);

            return;
        }

        const saved = await onSave(draft, (server) => {
            const mapped: DraftErrors = {};

            for (const [key, message] of Object.entries(server)) {
                if (key in draft) {
                    mapped[key as keyof ObjectiveDraft] = message;
                }
            }

            setErrors(mapped);
            focusFirst(mapped);
        });

        if (saved) {
            onOpenChange(false);
        }
    };

    const describedBy = (key: keyof ObjectiveDraft) =>
        errors[key] ? `${id}-${key}-hint` : undefined;

    return (
        <ResponsiveFormDialog
            open={open}
            onOpenChange={onOpenChange}
            mobile={mobile}
            title={title}
            description="Hasil besar yang ingin dicapai divisi dalam satu kuartal. Key result ditambahkan setelahnya."
            onSubmit={submit}
            actions={
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
                        form={formIdFor(title)}
                        disabled={processing}
                    >
                        {processing && <Spinner />}
                        {creating ? 'Buat objective' : 'Simpan perubahan'}
                    </Button>
                </>
            }
        >
            <div className="grid gap-4 sm:grid-cols-2">
                {creating ? (
                    <Field
                        id={`${id}-division_id`}
                        label="Divisi"
                        error={errors.division_id}
                    >
                        <Select
                            value={draft.division_id}
                            onValueChange={(value) => set('division_id', value)}
                        >
                            <SelectTrigger
                                id={`${id}-division_id`}
                                className="w-full"
                                aria-invalid={
                                    errors.division_id ? true : undefined
                                }
                                aria-describedby={describedBy('division_id')}
                            >
                                <SelectValue placeholder="Pilih divisi" />
                            </SelectTrigger>
                            <SelectContent>
                                {divisions.map((division) => (
                                    <SelectItem
                                        key={division.id}
                                        value={division.id}
                                    >
                                        {division.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Field>
                ) : (
                    <Field
                        id={`${id}-division`}
                        label="Divisi"
                        hint="Divisi tidak bisa diganti"
                    >
                        <Input
                            id={`${id}-division`}
                            value={objective.division.name}
                            readOnly
                            aria-describedby={`${id}-division-hint`}
                        />
                    </Field>
                )}
                <Field
                    id={`${id}-quarter`}
                    label="Kuartal"
                    error={errors.quarter}
                >
                    <Select
                        value={draft.quarter}
                        onValueChange={(value) => set('quarter', value)}
                    >
                        <SelectTrigger
                            id={`${id}-quarter`}
                            className="w-full"
                            aria-describedby={describedBy('quarter')}
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {quarterOptions.map((quarter) => (
                                <SelectItem key={quarter} value={quarter}>
                                    {quarterLabel(quarter, true)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>
            </div>

            <Field id={`${id}-title`} label="Objective" error={errors.title}>
                <Input
                    id={`${id}-title`}
                    value={draft.title}
                    maxLength={200}
                    placeholder="Mis. Migrasi sistem gudang tanpa insiden kritis"
                    aria-invalid={errors.title ? true : undefined}
                    aria-describedby={describedBy('title')}
                    onChange={(event) => set('title', event.target.value)}
                />
            </Field>

            <Field
                id={`${id}-description`}
                label="Deskripsi (opsional)"
                error={errors.description}
            >
                <Textarea
                    id={`${id}-description`}
                    value={draft.description}
                    rows={3}
                    maxLength={2000}
                    placeholder="Mengapa objective ini penting kuartal ini?"
                    aria-invalid={errors.description ? true : undefined}
                    aria-describedby={describedBy('description')}
                    onChange={(event) => set('description', event.target.value)}
                />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
                <Field
                    id={`${id}-owner_id`}
                    label="Pemilik"
                    error={errors.owner_id}
                >
                    <Select
                        value={draft.owner_id}
                        onValueChange={(value) => set('owner_id', value)}
                        disabled={creating && !draft.division_id}
                    >
                        <SelectTrigger
                            id={`${id}-owner_id`}
                            className="w-full"
                            aria-invalid={errors.owner_id ? true : undefined}
                            aria-describedby={describedBy('owner_id')}
                        >
                            <SelectValue
                                placeholder={
                                    creating && !draft.division_id
                                        ? 'Pilih divisi dulu'
                                        : 'Pilih pemilik'
                                }
                            />
                        </SelectTrigger>
                        <SelectContent>
                            {owners.map((owner) => (
                                <SelectItem key={owner.id} value={owner.id}>
                                    {owner.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>
                <Field id={`${id}-status`} label="Status">
                    <Select
                        value={draft.status}
                        onValueChange={(value) =>
                            set('status', value as ObjectiveDraft['status'])
                        }
                    >
                        <SelectTrigger id={`${id}-status`} className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="active">Aktif</SelectItem>
                            <SelectItem value="draft">
                                Draf (belum diumumkan)
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </Field>
            </div>
        </ResponsiveFormDialog>
    );
}
