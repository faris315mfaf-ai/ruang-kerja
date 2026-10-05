import { useForm } from '@inertiajs/react';
import DivisionController from '@/actions/App/Http/Controllers/Organization/DivisionController';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Field, SelectField } from './fields';
import { withCurrentPerson } from './person-options';
import type { DivisionRow, OrganizationOptions } from './types';
import { UnitSheet } from './unit-sheet';

type FormData = {
    name: string;
    code: string;
    is_board: boolean;
    parent_id: string | null;
    head_user_id: string | null;
};

type Props = {
    /** null = create a new division. */
    division: DivisionRow | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onDelete: (division: DivisionRow) => void;
    options: OrganizationOptions;
};

export function DivisionSheet({
    division,
    open,
    onOpenChange,
    onDelete,
    options,
}: Props) {
    const form = useForm<FormData>({
        name: division?.name ?? '',
        code: division?.code ?? '',
        is_board: division?.isBoard ?? false,
        parent_id: division?.parentId ?? null,
        head_user_id: division?.head?.id ?? null,
    });

    const submit = () => {
        const options = {
            preserveScroll: true,
            onSuccess: () => onOpenChange(false),
        };

        if (division) {
            form.put(DivisionController.update.url(division.id), options);
        } else {
            form.post(DivisionController.store.url(), options);
        }
    };

    const parentOptions = options.divisions
        .filter((option) => option.value !== division?.id && !option.isBoard)
        .map((option) => ({
            value: option.value,
            label: `${option.label} (${option.code})`,
        }));

    return (
        <UnitSheet
            open={open}
            onOpenChange={onOpenChange}
            title={division ? 'Ubah divisi' : 'Tambah divisi'}
            subject={division?.name}
            description="Divisi menjadi sumber struktur organisasi, awalan ID tugas, dan visibilitas Kepala Divisi."
            processing={form.processing}
            submitLabel={division ? 'Simpan perubahan' : 'Tambah divisi'}
            onSubmit={submit}
            onDelete={division ? () => onDelete(division) : undefined}
        >
            <Field
                id="division-name"
                label="Nama divisi"
                error={form.errors.name}
            >
                <Input
                    id="division-name"
                    value={form.data.name}
                    onChange={(event) =>
                        form.setData('name', event.target.value)
                    }
                    maxLength={120}
                    required
                    autoFocus
                    placeholder="mis. Keuangan"
                    aria-invalid={form.errors.name ? true : undefined}
                />
            </Field>

            <Field
                id="division-code"
                label="Kode"
                error={form.errors.code}
                hint="Huruf besar dan angka, maks. 10. Dipakai sebagai awalan ID tugas dan tidak bisa dipakai ulang setelah dihapus."
            >
                <Input
                    id="division-code"
                    value={form.data.code}
                    onChange={(event) =>
                        form.setData('code', event.target.value.toUpperCase())
                    }
                    maxLength={10}
                    required
                    autoComplete="off"
                    placeholder="mis. KEU"
                    className="font-mono uppercase"
                    aria-invalid={form.errors.code ? true : undefined}
                />
            </Field>

            <div className="grid gap-1.5">
                <div className="flex items-start gap-2.5">
                    <Checkbox
                        id="division-board"
                        checked={form.data.is_board}
                        onCheckedChange={(checked) => {
                            form.setData((data) => ({
                                ...data,
                                is_board: checked === true,
                                parent_id:
                                    checked === true ? null : data.parent_id,
                            }));
                        }}
                        className="mt-0.5"
                    />
                    <Label
                        htmlFor="division-board"
                        className="grid gap-0.5 text-[15px] font-normal"
                    >
                        <span className="font-medium text-text">
                            Unit Direksi
                        </span>
                        <span className="text-meta text-text-muted">
                            Puncak bagan organisasi. Hanya boleh satu.
                        </span>
                    </Label>
                </div>
                {form.errors.is_board && (
                    <p className="text-[15px] text-danger">
                        {form.errors.is_board}
                    </p>
                )}
            </div>

            {!form.data.is_board && (
                <Field
                    id="division-parent"
                    label="Induk divisi"
                    error={form.errors.parent_id}
                    hint="Kosongkan untuk divisi utama di bawah Direksi."
                >
                    <SelectField
                        id="division-parent"
                        value={form.data.parent_id}
                        onChange={(value) => form.setData('parent_id', value)}
                        options={parentOptions}
                        placeholder="Tanpa induk"
                        noneLabel="Tanpa induk"
                        invalid={Boolean(form.errors.parent_id)}
                    />
                </Field>
            )}

            <Field
                id="division-head"
                label={form.data.is_board ? 'Pimpinan' : 'Kepala divisi'}
                error={form.errors.head_user_id}
                hint="Kepala divisi melihat absensi, pengajuan, dan tugas seluruh anggota divisinya."
            >
                <SelectField
                    id="division-head"
                    value={form.data.head_user_id}
                    onChange={(value) => form.setData('head_user_id', value)}
                    options={withCurrentPerson(options.users, division?.head)}
                    placeholder="Belum ditentukan"
                    noneLabel="Belum ditentukan"
                    invalid={Boolean(form.errors.head_user_id)}
                />
            </Field>
        </UnitSheet>
    );
}
