import { useForm } from '@inertiajs/react';
import TeamController from '@/actions/App/Http/Controllers/Organization/TeamController';
import { Input } from '@/components/ui/input';
import { Field, SelectField } from './fields';
import { withCurrentPerson } from './person-options';
import type { OrganizationOptions, TeamRow } from './types';
import { UnitSheet } from './unit-sheet';

type FormData = {
    division_id: string | null;
    name: string;
    code: string;
    lead_user_id: string | null;
};

type Props = {
    team: TeamRow | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onDelete: (team: TeamRow) => void;
    options: OrganizationOptions;
};

export function TeamSheet({
    team,
    open,
    onOpenChange,
    onDelete,
    options,
}: Props) {
    const form = useForm<FormData>({
        division_id: team?.divisionId ?? null,
        name: team?.name ?? '',
        code: team?.code ?? '',
        lead_user_id: team?.lead?.id ?? null,
    });

    const submit = () => {
        const visit = {
            preserveScroll: true,
            onSuccess: () => onOpenChange(false),
        };

        if (team) {
            form.put(TeamController.update.url(team.id), visit);
        } else {
            form.post(TeamController.store.url(), visit);
        }
    };

    return (
        <UnitSheet
            open={open}
            onOpenChange={onOpenChange}
            title={team ? 'Ubah tim' : 'Tambah tim'}
            subject={team?.name}
            description="Tim mengelompokkan anggota di dalam satu divisi dan tampil di bagan organisasi."
            processing={form.processing}
            submitLabel={team ? 'Simpan perubahan' : 'Tambah tim'}
            onSubmit={submit}
            onDelete={team ? () => onDelete(team) : undefined}
        >
            <Field
                id="team-division"
                label="Divisi"
                error={form.errors.division_id}
            >
                <SelectField
                    id="team-division"
                    value={form.data.division_id}
                    onChange={(value) => form.setData('division_id', value)}
                    options={options.divisions.map((option) => ({
                        value: option.value,
                        label: `${option.label} (${option.code})`,
                    }))}
                    placeholder="Pilih divisi"
                    invalid={Boolean(form.errors.division_id)}
                />
            </Field>

            <Field id="team-name" label="Nama tim" error={form.errors.name}>
                <Input
                    id="team-name"
                    value={form.data.name}
                    onChange={(event) =>
                        form.setData('name', event.target.value)
                    }
                    maxLength={120}
                    required
                    autoFocus
                    placeholder="mis. Tim Gudang"
                    aria-invalid={form.errors.name ? true : undefined}
                />
            </Field>

            <Field
                id="team-code"
                label="Kode (opsional)"
                error={form.errors.code}
                hint="Label singkat di bagan, mis. GDG. Huruf besar dan angka, maks. 10."
            >
                <Input
                    id="team-code"
                    value={form.data.code}
                    onChange={(event) =>
                        form.setData('code', event.target.value.toUpperCase())
                    }
                    maxLength={10}
                    autoComplete="off"
                    className="font-mono uppercase"
                    aria-invalid={form.errors.code ? true : undefined}
                />
            </Field>

            <Field
                id="team-lead"
                label="Ketua tim"
                error={form.errors.lead_user_id}
            >
                <SelectField
                    id="team-lead"
                    value={form.data.lead_user_id}
                    onChange={(value) => form.setData('lead_user_id', value)}
                    options={withCurrentPerson(options.users, team?.lead)}
                    placeholder="Belum ditentukan"
                    noneLabel="Belum ditentukan"
                    invalid={Boolean(form.errors.lead_user_id)}
                />
            </Field>
        </UnitSheet>
    );
}
