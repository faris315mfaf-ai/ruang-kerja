import { usePage } from '@inertiajs/react';
import { LayoutTemplate } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { TextField } from '@/features/automation/form-fields';
import { FormSurface } from '@/features/automation/form-surface';
import { mutate } from '@/features/automation/mutation';
import { SettingsCard } from '@/features/workspaces/settings/settings-card';
import workspaceTemplateRoutes from '@/routes/automation/templates/workspaces';

/**
 * "Simpan sebagai template" (F2-4) in Pengaturan workspace: copies the
 * columns and labels of a team/project workspace into a company-wide
 * workspace template (WorkspaceTemplatePolicy::create). Renders nothing
 * while the automation feature is off, for other workspace types, or for
 * people who cannot manage the workspace.
 */
export function SaveWorkspaceTemplateSection({
    workspace,
    editable,
}: {
    workspace: { id: string; name: string; type: string };
    editable: boolean;
}) {
    const { features } = usePage().props;
    const [open, setOpen] = useState(false);
    const [name, setName] = useState(workspace.name);
    const [description, setDescription] = useState('');
    const [processing, setProcessing] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    if (
        !features?.automation ||
        !editable ||
        !['team', 'project'].includes(workspace.type)
    ) {
        return null;
    }

    const submit = () => {
        if (name.trim() === '') {
            setErrors({ name: 'Beri nama template.' });

            return;
        }

        setProcessing(true);
        mutate(
            'post',
            workspaceTemplateRoutes.store.url(workspace.id),
            { name: name.trim(), description: description.trim() || null },
            {
                onSuccess: () => setOpen(false),
                onError: setErrors,
                onFinish: () => setProcessing(false),
            },
        );
    };

    return (
        <SettingsCard
            id="template"
            title="Template"
            description="Simpan kolom status dan label workspace ini supaya workspace baru bisa memakainya (Otomasi › Template)."
            action={
                <Button
                    variant="outline"
                    onClick={() => {
                        setErrors({});
                        setOpen(true);
                    }}
                >
                    <LayoutTemplate aria-hidden />
                    Simpan sebagai template
                </Button>
            }
        >
            <div className="px-5 pb-6 md:px-7">
                <p className="text-meta text-text-muted">
                    Tugas dan anggota tidak ikut disalin.
                </p>
            </div>
            <FormSurface
                open={open}
                onOpenChange={setOpen}
                mobile={false}
                title="Simpan sebagai template"
                description="Template berlaku untuk semua workspace perusahaan."
                footer={
                    <>
                        <Button variant="quiet" onClick={() => setOpen(false)}>
                            Batal
                        </Button>
                        <Button onClick={submit} disabled={processing}>
                            {processing ? 'Menyimpan…' : 'Simpan template'}
                        </Button>
                    </>
                }
            >
                <TextField
                    label="Nama template"
                    value={name}
                    onChange={setName}
                    error={errors.name}
                />
                <TextField
                    label="Keterangan (opsional)"
                    value={description}
                    onChange={setDescription}
                    error={errors.description}
                />
            </FormSurface>
        </SettingsCard>
    );
}
