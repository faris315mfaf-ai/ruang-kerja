import { useId, useState } from 'react';
import { StatusIcon } from '@/components/status-icon';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SegmentedTabs } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
    FIELD_SIZE,
    SelectField,
    TextField,
} from '@/features/automation/form-fields';
import { FormSurface } from '@/features/automation/form-surface';
import {
    suggestWorkspaceKey,
    validateWorkspaceKey,
} from '@/features/automation/helpers';
import { LabelChip } from '@/features/automation/templates/template-parts';
import type {
    TaskTemplate,
    WorkspaceRef,
    WorkspaceTemplate,
} from '@/features/automation/types';
import { useFakeMutation } from '@/features/prototype/use-fake-mutation';
import { cn } from '@/lib/utils';

function Footer({
    onCancel,
    onSubmit,
    processing,
    label,
}: {
    onCancel: () => void;
    onSubmit: () => void;
    processing: boolean;
    label: string;
}) {
    return (
        <>
            <Button variant="quiet" onClick={onCancel} className="h-12 md:h-11">
                Batal
            </Button>
            <Button
                onClick={onSubmit}
                disabled={processing}
                className="h-12 md:h-11"
            >
                {processing ? 'Membuat…' : label}
            </Button>
        </>
    );
}

/** "Pakai template" for a task template: pick workspace, adjust title. */
export function UseTaskTemplate({
    template,
    workspaces,
    mobile,
    onOpenChange,
    onUsed,
}: {
    template: TaskTemplate;
    workspaces: WorkspaceRef[];
    mobile: boolean;
    onOpenChange: (open: boolean) => void;
    onUsed: () => void;
}) {
    const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id ?? '');
    const [title, setTitle] = useState(template.title);
    const [due, setDue] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const { processing, run } = useFakeMutation();
    const titleError =
        submitted && title.trim() === '' ? 'Isi judul tugas.' : undefined;
    const workspace = workspaces.find((w) => w.id === workspaceId);

    const submit = async () => {
        setSubmitted(true);

        if (title.trim() === '') {
            return;
        }

        const ok = await run(onUsed, {
            success: `Tugas ${workspace?.key ?? ''}-131 dibuat dari template "${template.name}"`,
        });

        if (ok) {
            onOpenChange(false);
        }
    };

    return (
        <FormSurface
            open
            onOpenChange={onOpenChange}
            mobile={mobile}
            title={`Pakai "${template.name}"`}
            description="Tugas baru dibuat dengan checklist, label, dan estimasi dari template."
            footer={
                <Footer
                    onCancel={() => onOpenChange(false)}
                    onSubmit={() => void submit()}
                    processing={processing}
                    label="Buat tugas"
                />
            }
        >
            <SelectField
                label="Workspace"
                value={workspaceId}
                onChange={setWorkspaceId}
                options={workspaces.map((w) => ({
                    value: w.id,
                    label: `${w.key} · ${w.name}`,
                }))}
            />
            <TextField
                label="Judul"
                value={title}
                onChange={setTitle}
                error={titleError}
                hint="Ganti bagian dalam [kurung siku]."
            />
            <TextField
                label="Tenggat (opsional)"
                type="date"
                value={due}
                onChange={setDue}
            />
            <div className="flex flex-col gap-2 rounded-lg bg-surface-2 p-4">
                <p className="text-label text-text">Ikut dibuat</p>
                <ul className="flex flex-col gap-1 text-[15px] text-text">
                    {template.checklist.map((item) => (
                        <li key={item} className="flex gap-2">
                            <span
                                aria-hidden
                                className="mt-2 size-1.5 shrink-0 rounded-full bg-text-subtle"
                            />
                            {item}
                        </li>
                    ))}
                </ul>
                {template.labels.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                        {template.labels.map((label) => (
                            <LabelChip key={label.id} label={label} />
                        ))}
                    </div>
                )}
            </div>
        </FormSurface>
    );
}

/** "Pakai template" for a workspace template: name, key, visibility. */
export function UseWorkspaceTemplate({
    template,
    takenKeys,
    mobile,
    onOpenChange,
}: {
    template: WorkspaceTemplate;
    takenKeys: string[];
    mobile: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [name, setName] = useState('');
    const [key, setKey] = useState('');
    const [keyEdited, setKeyEdited] = useState(false);
    const [visibility, setVisibility] = useState<'private' | 'internal'>(
        'private',
    );
    const [submitted, setSubmitted] = useState(false);
    const { processing, run } = useFakeMutation();
    const effectiveKey = keyEdited ? key : suggestWorkspaceKey(name);
    const nameError =
        submitted && name.trim() === '' ? 'Isi nama workspace.' : undefined;
    const keyError = submitted
        ? (validateWorkspaceKey(effectiveKey, takenKeys) ?? undefined)
        : undefined;

    const submit = async () => {
        setSubmitted(true);

        if (
            name.trim() === '' ||
            validateWorkspaceKey(effectiveKey, takenKeys)
        ) {
            return;
        }

        const ok = await run(() => undefined, {
            success: `Workspace ${effectiveKey} dibuat dengan ${template.statuses.length} kolom`,
        });

        if (ok) {
            onOpenChange(false);
        }
    };

    return (
        <FormSurface
            open
            onOpenChange={onOpenChange}
            mobile={mobile}
            title={`Workspace dari "${template.name}"`}
            description="Kolom status dan label disalin. Anggota dipilih setelah dibuat."
            footer={
                <Footer
                    onCancel={() => onOpenChange(false)}
                    onSubmit={() => void submit()}
                    processing={processing}
                    label="Buat workspace"
                />
            }
        >
            <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
                <TextField
                    label="Nama workspace"
                    value={name}
                    placeholder="Mis. Peluncuran Produk X"
                    onChange={setName}
                    error={nameError}
                />
                <TextField
                    label="Kode tugas"
                    value={effectiveKey}
                    onChange={(value) => {
                        setKeyEdited(true);
                        setKey(value.toUpperCase());
                    }}
                    error={keyError}
                    hint={effectiveKey ? `Tugas: ${effectiveKey}-1` : undefined}
                    inputClassName="font-mono uppercase"
                />
            </div>
            <div className="flex flex-col gap-1.5">
                <span className="text-label text-text">Visibilitas</span>
                <SegmentedTabs
                    label="Visibilitas"
                    semantics="radio"
                    value={visibility}
                    onValueChange={setVisibility}
                    options={[
                        { value: 'private', label: 'Privat' },
                        { value: 'internal', label: 'Internal' },
                    ]}
                    className="self-start"
                />
                <p className="text-meta text-text-muted">
                    {visibility === 'private'
                        ? 'Hanya anggota yang melihat.'
                        : 'Semua karyawan bisa melihat, hanya anggota yang mengubah.'}
                </p>
            </div>
            <div className="flex flex-col gap-2 rounded-lg bg-surface-2 p-4">
                <p className="text-label text-text">Kolom status</p>
                <ol className="flex flex-wrap gap-2">
                    {template.statuses.map((status) => (
                        <li
                            key={status.name}
                            className="inline-flex h-8 items-center gap-1.5 rounded-sm bg-surface px-2.5 text-[14px] font-semibold text-text"
                        >
                            <StatusIcon
                                category={status.category}
                                color={status.color}
                            />
                            {status.name}
                        </li>
                    ))}
                </ol>
            </div>
        </FormSurface>
    );
}

/** "Template baru" (task): name, title, checklist lines, estimate. */
export function NewTaskTemplate({
    mobile,
    onOpenChange,
    onCreated,
}: {
    mobile: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated: (template: TaskTemplate) => void;
}) {
    const [name, setName] = useState('');
    const [title, setTitle] = useState('');
    const [checklist, setChecklist] = useState('');
    const [estimate, setEstimate] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const { processing, run } = useFakeMutation();
    const checklistId = useId();
    const items = checklist
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    const estimateNumber = estimate === '' ? null : Number(estimate);
    const errors = submitted
        ? {
              name: name.trim() === '' ? 'Beri nama template.' : undefined,
              title:
                  title.trim() === '' ? 'Isi judul tugas bawaan.' : undefined,
              estimate:
                  estimateNumber !== null &&
                  (!Number.isFinite(estimateNumber) ||
                      estimateNumber <= 0 ||
                      estimateNumber > 999)
                      ? 'Estimasi 0,5–999 jam.'
                      : undefined,
          }
        : {};

    const submit = async () => {
        setSubmitted(true);

        if (
            name.trim() === '' ||
            title.trim() === '' ||
            (estimateNumber !== null &&
                (estimateNumber <= 0 || estimateNumber > 999))
        ) {
            return;
        }

        const ok = await run(
            () =>
                onCreated({
                    id: `new-${Date.now()}`,
                    name: name.trim(),
                    description: 'Template buatan Anda.',
                    title: title.trim(),
                    priority: 0,
                    estimate_hours: estimateNumber,
                    checklist: items,
                    labels: [],
                    used_count: 0,
                }),
            { success: 'Template disimpan' },
        );

        if (ok) {
            onOpenChange(false);
        }
    };

    return (
        <FormSurface
            open
            onOpenChange={onOpenChange}
            mobile={mobile}
            title="Template tugas baru"
            footer={
                <Footer
                    onCancel={() => onOpenChange(false)}
                    onSubmit={() => void submit()}
                    processing={processing}
                    label="Simpan template"
                />
            }
        >
            <TextField
                label="Nama template"
                value={name}
                onChange={setName}
                error={errors.name}
            />
            <TextField
                label="Judul tugas bawaan"
                value={title}
                placeholder="Mis. Kunjungan [klien]"
                onChange={setTitle}
                error={errors.title}
            />
            <div className="flex flex-col gap-1.5">
                <Label htmlFor={checklistId}>Checklist (satu per baris)</Label>
                <Textarea
                    id={checklistId}
                    value={checklist}
                    rows={4}
                    onChange={(event) => setChecklist(event.target.value)}
                    className={cn(FIELD_SIZE, 'h-auto min-h-28 md:h-auto')}
                />
                <p className="text-meta text-text-muted tnum">
                    {items.length} butir
                </p>
            </div>
            <TextField
                label="Estimasi (jam, opsional)"
                type="number"
                min={0.5}
                max={999}
                value={estimate}
                onChange={setEstimate}
                error={errors.estimate}
                inputClassName="w-32"
            />
        </FormSurface>
    );
}
