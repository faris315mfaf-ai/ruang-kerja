import { useId, useState } from 'react';
import { PRIORITY_LABELS, PRIORITY_ORDER } from '@/components/priority-icon';
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
import { mutate } from '@/features/automation/mutation';
import { LabelChip } from '@/features/automation/templates/template-parts';
import type {
    TaskTemplate,
    WorkspaceRef,
    WorkspaceTemplate,
} from '@/features/automation/types';
import { cn } from '@/lib/utils';
import taskTemplateRoutes from '@/routes/automation/templates/tasks';
import workspaceTemplateRoutes from '@/routes/automation/templates/workspaces';

/** Estimate rule shared with TaskTemplateRequest (0,5–999 jam). */
export function estimateError(value: string): string | undefined {
    if (value.trim() === '') {
        return undefined;
    }

    const number = Number(value.replace(',', '.'));

    return Number.isFinite(number) && number >= 0.5 && number <= 999
        ? undefined
        : 'Estimasi 0,5–999 jam.';
}

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
                {processing ? 'Menyimpan…' : label}
            </Button>
        </>
    );
}

/**
 * "Pakai template" for a task template: workspace (only where the person
 * may create tasks; a workspace template stays in its workspace), title and
 * due date — all sent to the server.
 */
export function UseTaskTemplate({
    template,
    workspaces,
    mobile,
    onOpenChange,
}: {
    template: TaskTemplate;
    workspaces: WorkspaceRef[];
    mobile: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const targets = workspaces.filter(
        (w) =>
            w.can_edit_tasks &&
            (template.workspace_id === null || w.id === template.workspace_id),
    );
    const [workspaceId, setWorkspaceId] = useState(targets[0]?.id ?? '');
    const [title, setTitle] = useState(template.title);
    const [due, setDue] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [server, setServer] = useState<Record<string, string>>({});
    const titleError =
        submitted && title.trim() === '' ? 'Isi judul tugas.' : server.title;

    const submit = () => {
        setSubmitted(true);
        setServer({});

        if (title.trim() === '' || workspaceId === '') {
            return;
        }

        setProcessing(true);
        mutate(
            'post',
            taskTemplateRoutes.apply.url(template.id),
            {
                workspace_id: workspaceId,
                title: title.trim(),
                due_date: due || null,
            },
            {
                only: ['templates'],
                onSuccess: () => onOpenChange(false),
                onError: setServer,
                onFinish: () => setProcessing(false),
            },
        );
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
                    onSubmit={submit}
                    processing={processing}
                    label="Buat tugas"
                />
            }
        >
            <SelectField
                label="Workspace"
                value={workspaceId}
                onChange={setWorkspaceId}
                options={targets.map((w) => ({
                    value: w.id,
                    label: `${w.key} · ${w.name}`,
                }))}
                error={
                    server.workspace_id ??
                    (submitted && workspaceId === ''
                        ? 'Pilih workspace.'
                        : undefined)
                }
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
                error={server.due_date}
            />
            {(template.checklist.length > 0 || template.labels.length > 0) && (
                <div className="flex flex-col gap-2 rounded-lg bg-surface-2 p-4">
                    <p className="text-label text-text">Ikut dibuat</p>
                    <ul className="flex flex-col gap-1 text-[15px] text-text">
                        {template.checklist.map((item, index) => (
                            <li key={`${index}-${item}`} className="flex gap-2">
                                <span
                                    aria-hidden
                                    className="mt-2 size-1.5 shrink-0 rounded-full bg-text-subtle"
                                />
                                <span className="min-w-0 break-words">
                                    {item}
                                </span>
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
                    {template.labels.length > 0 && (
                        <p className="text-meta text-text-muted">
                            Label dicocokkan dengan nama di workspace tujuan;
                            yang belum ada dibuat bila Anda admin workspace.
                        </p>
                    )}
                </div>
            )}
        </FormSurface>
    );
}

/**
 * "Pakai template" for a workspace template: name, key, visibility. The
 * workspace is created on the server and opened.
 */
export function UseWorkspaceTemplate({
    template,
    takenKeys,
    mobile,
    onOpenChange,
}: {
    template: WorkspaceTemplate;
    /** Keys the person can see (early feedback; the server checks all keys). */
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
    const [processing, setProcessing] = useState(false);
    const [server, setServer] = useState<Record<string, string>>({});
    const effectiveKey = keyEdited ? key : suggestWorkspaceKey(name);
    const nameError =
        submitted && name.trim() === '' ? 'Isi nama workspace.' : server.name;
    const keyError =
        (submitted
            ? (validateWorkspaceKey(effectiveKey, takenKeys) ?? undefined)
            : undefined) ?? server.key;

    const submit = () => {
        setSubmitted(true);
        setServer({});

        if (
            name.trim() === '' ||
            validateWorkspaceKey(effectiveKey, takenKeys)
        ) {
            return;
        }

        setProcessing(true);
        mutate(
            'post',
            workspaceTemplateRoutes.apply.url(template.id),
            { name: name.trim(), key: effectiveKey, visibility },
            {
                onSuccess: () => onOpenChange(false),
                onError: setServer,
                onFinish: () => setProcessing(false),
            },
        );
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
                    onSubmit={submit}
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

const COMPANY = 'perusahaan';

/**
 * "Template tugas baru": scope (all workspaces when allowed, or one
 * workspace the person manages), name, default title, priority, checklist,
 * labels and estimate.
 */
export function NewTaskTemplate({
    mobile,
    workspaces,
    canCreateCompanyTemplate,
    onOpenChange,
}: {
    mobile: boolean;
    workspaces: WorkspaceRef[];
    canCreateCompanyTemplate: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const manageable = workspaces.filter((w) => w.can_manage);
    const [scope, setScope] = useState(
        canCreateCompanyTemplate ? COMPANY : (manageable[0]?.id ?? ''),
    );
    const [name, setName] = useState('');
    const [title, setTitle] = useState('');
    const [priority, setPriority] = useState('0');
    const [checklist, setChecklist] = useState('');
    const [labels, setLabels] = useState('');
    const [estimate, setEstimate] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [server, setServer] = useState<Record<string, string>>({});
    const checklistId = useId();
    const items = checklist
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    const labelNames = [
        ...new Set(
            labels
                .split(',')
                .map((label) => label.trim())
                .filter(Boolean),
        ),
    ];
    const local = {
        name: name.trim() === '' ? 'Beri nama template.' : undefined,
        title: title.trim() === '' ? 'Isi judul tugas bawaan.' : undefined,
        estimate_hours: estimateError(estimate),
    };
    const errors: Partial<typeof local> = submitted ? local : {};
    const checklistError = Object.entries(server).find(([key]) =>
        key.startsWith('checklist'),
    )?.[1];
    const labelsError = Object.entries(server).find(([key]) =>
        key.startsWith('labels'),
    )?.[1];

    const submit = () => {
        setSubmitted(true);
        setServer({});

        if (Object.values(local).some(Boolean) || scope === '') {
            return;
        }

        setProcessing(true);
        mutate(
            'post',
            taskTemplateRoutes.store.url(),
            {
                workspace_id: scope === COMPANY ? null : scope,
                name: name.trim(),
                title: title.trim(),
                priority: Number(priority),
                estimate_hours:
                    estimate.trim() === ''
                        ? null
                        : Number(estimate.replace(',', '.')),
                checklist: items,
                labels: labelNames.map((label) => ({
                    name: label,
                    color: 'gray',
                })),
            },
            {
                only: ['templates'],
                onSuccess: () => onOpenChange(false),
                onError: setServer,
                onFinish: () => setProcessing(false),
            },
        );
    };

    return (
        <FormSurface
            open
            onOpenChange={onOpenChange}
            mobile={mobile}
            wide
            title="Template tugas baru"
            footer={
                <Footer
                    onCancel={() => onOpenChange(false)}
                    onSubmit={submit}
                    processing={processing}
                    label="Simpan template"
                />
            }
        >
            <SelectField
                label="Berlaku untuk"
                value={scope}
                onChange={setScope}
                options={[
                    ...(canCreateCompanyTemplate
                        ? [{ value: COMPANY, label: 'Semua workspace' }]
                        : []),
                    ...manageable.map((w) => ({
                        value: w.id,
                        label: `Hanya ${w.key} · ${w.name}`,
                    })),
                ]}
                error={server.workspace_id}
            />
            <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                    label="Nama template"
                    value={name}
                    onChange={setName}
                    error={errors.name ?? server.name}
                />
                <SelectField
                    label="Prioritas"
                    value={priority}
                    onChange={setPriority}
                    options={PRIORITY_ORDER.map((value) => ({
                        value: String(value),
                        label: PRIORITY_LABELS[value],
                    }))}
                />
            </div>
            <TextField
                label="Judul tugas bawaan"
                value={title}
                placeholder="Mis. Kunjungan [klien]"
                onChange={setTitle}
                error={errors.title ?? server.title}
            />
            <div className="flex flex-col gap-1.5">
                <Label htmlFor={checklistId}>Checklist (satu per baris)</Label>
                <Textarea
                    id={checklistId}
                    value={checklist}
                    rows={4}
                    onChange={(event) => setChecklist(event.target.value)}
                    aria-invalid={checklistError ? true : undefined}
                    className={cn(FIELD_SIZE, 'h-auto min-h-28 md:h-auto')}
                />
                <p
                    className={cn(
                        'text-meta tnum',
                        checklistError
                            ? 'font-semibold text-danger'
                            : 'text-text-muted',
                    )}
                    role={checklistError ? 'alert' : undefined}
                >
                    {checklistError ?? `${items.length} butir`}
                </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
                <TextField
                    label="Label (opsional, pisahkan koma)"
                    value={labels}
                    placeholder="Mis. Klien, Lapangan"
                    onChange={setLabels}
                    error={labelsError}
                    hint="Dicocokkan dengan nama label di workspace tujuan."
                />
                <TextField
                    label="Estimasi (jam)"
                    type="number"
                    min={0.5}
                    max={999}
                    value={estimate}
                    onChange={setEstimate}
                    error={errors.estimate_hours ?? server.estimate_hours}
                    hint="0,5–999 jam"
                />
            </div>
        </FormSurface>
    );
}
