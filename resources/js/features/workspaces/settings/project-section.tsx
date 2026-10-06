import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { fieldClasses } from '@/components/ui/input';
import type { ProjectStatus } from '@/features/portfolio/types';
import { cn } from '@/lib/utils';
import { update } from '@/routes/projects/attributes';
import type { MemberDetail, Option, WorkspaceDetail } from '../types';
import { SettingsCard, selectClass } from './settings-card';

export type ProjectSettings = {
    attributes: {
        lead_user_id: string | null;
        sponsor_user_id: string | null;
        division_id: string | null;
        start_date: string | null;
        target_date: string | null;
        project_status: ProjectStatus;
    };
    sponsor_options: Option[];
    division_options: Option[];
    status_options: Option<ProjectStatus>[];
};

type Props = {
    workspace: WorkspaceDetail;
    settings: ProjectSettings;
    members: MemberDetail[];
    editable: boolean;
};

const input = cn(fieldClasses, 'h-11');

/** Pengaturan › Proyek (PRD M10 atribut proyek, Sprint 9). */
export function ProjectSection({
    workspace,
    settings,
    members,
    editable,
}: Props) {
    const form = useForm({
        lead_user_id: settings.attributes.lead_user_id ?? '',
        sponsor_user_id: settings.attributes.sponsor_user_id ?? '',
        division_id: settings.attributes.division_id ?? '',
        start_date: settings.attributes.start_date ?? '',
        target_date: settings.attributes.target_date ?? '',
        project_status: settings.attributes.project_status,
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.submit(update(workspace.key), { preserveScroll: true });
    };

    const select = (
        key: 'lead_user_id' | 'sponsor_user_id' | 'division_id',
        label: string,
        options: Option[],
        empty: string,
    ) => (
        <label className="flex flex-col gap-2">
            <span className="text-label text-text">{label}</span>
            <select
                className={cn(selectClass, 'w-full')}
                value={form.data[key]}
                disabled={!editable}
                onChange={(event) => form.setData(key, event.target.value)}
            >
                <option value="">{empty}</option>
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
            <InputError message={form.errors[key]} />
        </label>
    );

    return (
        <SettingsCard
            id="proyek"
            title="Proyek"
            description="Atribut untuk portofolio Direksi: PIC, sponsor, jadwal, dan status siklus."
        >
            <form
                onSubmit={submit}
                className="flex flex-col gap-4 px-5 pb-6 md:px-7"
            >
                <div className="grid gap-4 sm:grid-cols-2">
                    {select(
                        'lead_user_id',
                        'PIC (penanggung jawab)',
                        members.map((member) => ({
                            value: member.id,
                            label: member.name,
                        })),
                        'Belum ditentukan',
                    )}
                    {select(
                        'sponsor_user_id',
                        'Sponsor (Direksi)',
                        settings.sponsor_options,
                        'Belum ditentukan',
                    )}
                    {select(
                        'division_id',
                        'Divisi utama',
                        settings.division_options,
                        'Tidak ada',
                    )}
                    <label className="flex flex-col gap-2">
                        <span className="text-label text-text">
                            Status siklus
                        </span>
                        <select
                            className={cn(selectClass, 'w-full')}
                            value={form.data.project_status}
                            disabled={!editable}
                            onChange={(event) =>
                                form.setData(
                                    'project_status',
                                    event.target.value as ProjectStatus,
                                )
                            }
                        >
                            {settings.status_options.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        <InputError message={form.errors.project_status} />
                    </label>
                    <label className="flex flex-col gap-2">
                        <span className="text-label text-text">
                            Tanggal mulai
                        </span>
                        <input
                            type="date"
                            className={input}
                            value={form.data.start_date}
                            disabled={!editable}
                            onChange={(event) =>
                                form.setData('start_date', event.target.value)
                            }
                        />
                        <InputError message={form.errors.start_date} />
                    </label>
                    <label className="flex flex-col gap-2">
                        <span className="text-label text-text">
                            Target selesai
                        </span>
                        <input
                            type="date"
                            className={input}
                            value={form.data.target_date}
                            disabled={!editable}
                            onChange={(event) =>
                                form.setData('target_date', event.target.value)
                            }
                        />
                        <InputError message={form.errors.target_date} />
                    </label>
                </div>
                <p className="text-meta text-text-muted">
                    PIC harus anggota workspace; ia menulis update mingguan dan
                    mengelola milestone serta risiko. Progres rencana dihitung
                    dari tanggal mulai sampai target.
                </p>
                {editable && (
                    <div className="flex justify-end gap-2 border-t border-border pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={!form.isDirty}
                            onClick={() => form.reset()}
                        >
                            Batal
                        </Button>
                        <Button
                            type="submit"
                            disabled={form.processing || !form.isDirty}
                        >
                            Simpan perubahan
                        </Button>
                    </div>
                )}
            </form>
        </SettingsCard>
    );
}
