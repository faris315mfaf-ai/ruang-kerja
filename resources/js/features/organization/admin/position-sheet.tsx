import { useForm } from '@inertiajs/react';
import PositionController from '@/actions/App/Http/Controllers/Organization/PositionController';
import { Input } from '@/components/ui/input';
import { Field, SelectField } from './fields';
import type { OrganizationOptions, PositionRow } from './types';
import { UnitSheet } from './unit-sheet';

type FormData = {
    name: string;
    level: number;
    dashboard_role?: string | null;
};

type Props = {
    position: PositionRow | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onDelete: (position: PositionRow) => void;
    options: OrganizationOptions;
};

export function PositionSheet({
    position,
    open,
    onOpenChange,
    onDelete,
    options,
}: Props) {
    const dashboards = options.dashboardRoles;
    const form = useForm<FormData>({
        name: position?.name ?? '',
        level: position?.level ?? 5,
        // Sent only while the field is shown, so a hidden field never clears a mapping.
        ...(dashboards.length > 0
            ? { dashboard_role: position?.dashboardRole ?? null }
            : {}),
    });

    const submit = () => {
        const visit = {
            preserveScroll: true,
            onSuccess: () => onOpenChange(false),
        };

        if (position) {
            form.put(PositionController.update.url(position.id), visit);
        } else {
            form.post(PositionController.store.url(), visit);
        }
    };

    return (
        <UnitSheet
            open={open}
            onOpenChange={onOpenChange}
            title={position ? 'Ubah jabatan' : 'Tambah jabatan'}
            subject={position?.name}
            description="Jabatan tampil di profil dan bagan; level menentukan urutan di bagan."
            processing={form.processing}
            submitLabel={position ? 'Simpan perubahan' : 'Tambah jabatan'}
            onSubmit={submit}
            onDelete={position ? () => onDelete(position) : undefined}
        >
            <Field
                id="position-name"
                label="Nama jabatan"
                error={form.errors.name}
            >
                <Input
                    id="position-name"
                    value={form.data.name}
                    onChange={(event) =>
                        form.setData('name', event.target.value)
                    }
                    maxLength={120}
                    required
                    autoFocus
                    placeholder="mis. Staf Keuangan"
                    aria-invalid={form.errors.name ? true : undefined}
                />
            </Field>

            <Field
                id="position-level"
                label="Level"
                error={form.errors.level}
                hint="1 = Direksi … 5 = Staf."
            >
                <SelectField
                    id="position-level"
                    value={String(form.data.level)}
                    onChange={(value) =>
                        form.setData('level', Number(value ?? 5))
                    }
                    options={options.levels.map((level) => ({
                        value: String(level.value),
                        label: `${level.value} · ${level.label}`,
                    }))}
                    placeholder="Pilih level"
                    invalid={Boolean(form.errors.level)}
                />
            </Field>

            {dashboards.length > 0 && (
                <Field
                    id="position-dashboard"
                    label="Dashboard jabatan"
                    error={form.errors.dashboard_role}
                    hint="Pemegang jabatan ini membuka dashboard tersebut di /peran. Direksi bisa melihat semua."
                >
                    <SelectField
                        id="position-dashboard"
                        value={form.data.dashboard_role ?? null}
                        onChange={(value) =>
                            form.setData('dashboard_role', value)
                        }
                        options={dashboards}
                        placeholder="Tanpa dashboard jabatan"
                        noneLabel="Tanpa dashboard jabatan"
                        invalid={Boolean(form.errors.dashboard_role)}
                    />
                </Field>
            )}
        </UnitSheet>
    );
}
