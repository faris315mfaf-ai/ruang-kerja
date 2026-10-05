import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { HEALTH_TONES } from '@/features/portfolio/lib';
import { fieldClass, ResponsiveSheet } from '@/features/portfolio/parts';
import type {
    MilestoneDetail,
    Option,
    ProjectHealth,
    RiskItem,
    RiskLevel,
    TaskRef,
} from '@/features/portfolio/types';
import type { WorkspaceMember } from '@/features/tasks/types';
import { cn } from '@/lib/utils';
import {
    store as storeMilestone,
    update as updateMilestone,
} from '@/routes/projects/milestones';
import {
    store as storeRisk,
    update as updateRisk,
} from '@/routes/projects/risks';
import { store as storeUpdate } from '@/routes/projects/updates';

function Footer({
    onCancel,
    onSubmit,
    disabled,
    label,
}: {
    onCancel: () => void;
    onSubmit: () => void;
    disabled: boolean;
    label: string;
}) {
    return (
        <div className="flex w-full justify-end gap-2">
            <Button
                type="button"
                variant="outline"
                className="h-11 md:h-9"
                onClick={onCancel}
            >
                Batal
            </Button>
            <Button
                type="button"
                className="h-11 md:h-9"
                disabled={disabled}
                onClick={onSubmit}
            >
                {label}
            </Button>
        </div>
    );
}

function Field({
    label,
    hint,
    error,
    children,
}: {
    label: string;
    hint?: string;
    error?: string;
    children: React.ReactNode;
}) {
    return (
        <label className="block space-y-1.5">
            <span className="text-[13px] font-medium text-text">
                {label}
                {hint && (
                    <span className="ml-1 font-normal text-text-muted">
                        {hint}
                    </span>
                )}
            </span>
            {children}
            <InputError message={error} />
        </label>
    );
}

/** "Update proyek" (PIC / workspace admin). */
export function ProjectUpdateDialog({
    projectKey,
    healthOptions,
    open,
    onOpenChange,
}: {
    projectKey: string;
    healthOptions: Option<ProjectHealth>[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const form = useForm<{
        health: ProjectHealth | '';
        summary: string;
        blockers: string;
        decision_needed: string;
    }>({ health: '', summary: '', blockers: '', decision_needed: '' });

    const submit = (event?: FormEvent) => {
        event?.preventDefault();
        form.submit(storeUpdate(projectKey), {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                onOpenChange(false);
            },
        });
    };

    return (
        <ResponsiveSheet
            open={open}
            onOpenChange={onOpenChange}
            title="Update proyek"
            description="Update mingguan untuk Direksi. Status ditetapkan oleh Anda sebagai PIC."
            footer={
                <Footer
                    onCancel={() => onOpenChange(false)}
                    onSubmit={() => submit()}
                    disabled={
                        form.processing ||
                        form.data.health === '' ||
                        form.data.summary.trim() === ''
                    }
                    label="Kirim update"
                />
            }
        >
            <form onSubmit={submit} className="space-y-4">
                <fieldset className="space-y-1.5">
                    <legend className="text-[13px] font-medium text-text">
                        Status kesehatan
                    </legend>
                    <div className="grid grid-cols-3 gap-2">
                        {healthOptions.map((option) => (
                            <label
                                key={option.value}
                                className={cn(
                                    'flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-md border px-2 text-[13px]',
                                    form.data.health === option.value
                                        ? cn(
                                              'border-transparent',
                                              HEALTH_TONES[option.value].pill,
                                          )
                                        : 'border-border text-text-muted',
                                )}
                            >
                                <input
                                    type="radio"
                                    name="health"
                                    value={option.value}
                                    className="sr-only"
                                    checked={form.data.health === option.value}
                                    onChange={() =>
                                        form.setData('health', option.value)
                                    }
                                />
                                <span
                                    aria-hidden
                                    className={cn(
                                        'size-2 rounded-full',
                                        HEALTH_TONES[option.value].dot,
                                    )}
                                />
                                {option.label}
                            </label>
                        ))}
                    </div>
                    <InputError message={form.errors.health} />
                </fieldset>
                <Field label="Ringkasan" error={form.errors.summary}>
                    <textarea
                        className={cn(fieldClass, 'min-h-24')}
                        value={form.data.summary}
                        maxLength={2000}
                        placeholder="Apa yang selesai minggu ini dan apa berikutnya?"
                        onChange={(event) =>
                            form.setData('summary', event.target.value)
                        }
                    />
                </Field>
                <Field
                    label="Hambatan"
                    hint="(opsional)"
                    error={form.errors.blockers}
                >
                    <textarea
                        className={cn(fieldClass, 'min-h-16')}
                        value={form.data.blockers}
                        maxLength={2000}
                        onChange={(event) =>
                            form.setData('blockers', event.target.value)
                        }
                    />
                </Field>
                <Field
                    label="Keputusan yang dibutuhkan dari Direksi"
                    hint="(opsional)"
                    error={form.errors.decision_needed}
                >
                    <textarea
                        className={cn(fieldClass, 'min-h-16')}
                        value={form.data.decision_needed}
                        maxLength={1000}
                        placeholder="Mis. persetujuan tambahan anggaran vendor video."
                        onChange={(event) =>
                            form.setData('decision_needed', event.target.value)
                        }
                    />
                </Field>
            </form>
        </ResponsiveSheet>
    );
}

/** Create / edit a milestone with its linked tasks. */
export function MilestoneDialog({
    projectKey,
    milestone,
    taskOptions,
    open,
    onOpenChange,
}: {
    projectKey: string;
    milestone: MilestoneDetail | null;
    taskOptions: TaskRef[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const form = useForm({
        name: milestone?.name ?? '',
        description: milestone?.description ?? '',
        target_date: milestone?.target_date ?? '',
        task_ids: milestone?.tasks.map((task) => task.id) ?? ([] as string[]),
    });

    const submit = (event?: FormEvent) => {
        event?.preventDefault();
        const route = milestone
            ? updateMilestone({
                  workspace: projectKey,
                  milestone: milestone.id,
              })
            : storeMilestone(projectKey);

        form.submit(route, {
            preserveScroll: true,
            onSuccess: () => onOpenChange(false),
        });
    };

    const toggle = (id: string) =>
        form.setData(
            'task_ids',
            form.data.task_ids.includes(id)
                ? form.data.task_ids.filter((taskId) => taskId !== id)
                : [...form.data.task_ids, id],
        );

    return (
        <ResponsiveSheet
            open={open}
            onOpenChange={onOpenChange}
            title={milestone ? 'Ubah milestone' : 'Milestone baru'}
            footer={
                <Footer
                    onCancel={() => onOpenChange(false)}
                    onSubmit={() => submit()}
                    disabled={
                        form.processing ||
                        form.data.name.trim() === '' ||
                        form.data.target_date === ''
                    }
                    label="Simpan"
                />
            }
        >
            <form onSubmit={submit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-[1fr_170px]">
                    <Field label="Nama" error={form.errors.name}>
                        <input
                            className={fieldClass}
                            value={form.data.name}
                            maxLength={160}
                            onChange={(event) =>
                                form.setData('name', event.target.value)
                            }
                        />
                    </Field>
                    <Field label="Target" error={form.errors.target_date}>
                        <input
                            type="date"
                            className={fieldClass}
                            value={form.data.target_date}
                            onChange={(event) =>
                                form.setData('target_date', event.target.value)
                            }
                        />
                    </Field>
                </div>
                <Field
                    label="Deskripsi"
                    hint="(opsional)"
                    error={form.errors.description}
                >
                    <textarea
                        className={cn(fieldClass, 'min-h-16')}
                        value={form.data.description}
                        maxLength={1000}
                        onChange={(event) =>
                            form.setData('description', event.target.value)
                        }
                    />
                </Field>
                <fieldset className="space-y-1.5">
                    <legend className="text-[13px] font-medium text-text">
                        Tugas terkait{' '}
                        <span className="font-normal text-text-muted">
                            ({form.data.task_ids.length})
                        </span>
                    </legend>
                    <ul className="max-h-52 divide-y divide-border overflow-y-auto rounded-md border border-border">
                        {taskOptions.length === 0 && (
                            <li className="px-3 py-2 text-[13px] text-text-muted">
                                Belum ada tugas.
                            </li>
                        )}
                        {taskOptions.map((task) => (
                            <li key={task.id}>
                                <label className="flex min-h-11 cursor-pointer items-center gap-2.5 px-3 text-[13px] md:min-h-9">
                                    <input
                                        type="checkbox"
                                        className="size-4 accent-primary"
                                        checked={form.data.task_ids.includes(
                                            task.id,
                                        )}
                                        onChange={() => toggle(task.id)}
                                    />
                                    <span className="font-mono text-[12px] text-text-muted">
                                        {task.code}
                                    </span>
                                    <span className="truncate text-text">
                                        {task.title}
                                    </span>
                                </label>
                            </li>
                        ))}
                    </ul>
                </fieldset>
            </form>
        </ResponsiveSheet>
    );
}

/** Create / edit a risk. */
export function RiskDialog({
    projectKey,
    risk,
    members,
    taskOptions,
    levelOptions,
    open,
    onOpenChange,
}: {
    projectKey: string;
    risk: RiskItem | null;
    members: WorkspaceMember[];
    taskOptions: TaskRef[];
    levelOptions: Option<RiskLevel>[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const form = useForm({
        title: risk?.title ?? '',
        level: risk?.level ?? ('medium' as RiskLevel),
        owner_id: risk?.owner?.id ?? '',
        task_id: risk?.task?.id ?? '',
        status: risk?.status ?? ('open' as 'open' | 'resolved'),
    });

    const submit = (event?: FormEvent) => {
        event?.preventDefault();
        const route = risk
            ? updateRisk({ workspace: projectKey, risk: risk.id })
            : storeRisk(projectKey);

        form.submit(route, {
            preserveScroll: true,
            onSuccess: () => onOpenChange(false),
        });
    };

    return (
        <ResponsiveSheet
            open={open}
            onOpenChange={onOpenChange}
            title={risk ? 'Ubah risiko' : 'Risiko baru'}
            footer={
                <Footer
                    onCancel={() => onOpenChange(false)}
                    onSubmit={() => submit()}
                    disabled={form.processing || form.data.title.trim() === ''}
                    label="Simpan"
                />
            }
        >
            <form onSubmit={submit} className="space-y-4">
                <Field label="Judul" error={form.errors.title}>
                    <input
                        className={fieldClass}
                        value={form.data.title}
                        maxLength={200}
                        onChange={(event) =>
                            form.setData('title', event.target.value)
                        }
                    />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Level" error={form.errors.level}>
                        <select
                            className={fieldClass}
                            value={form.data.level}
                            onChange={(event) =>
                                form.setData(
                                    'level',
                                    event.target.value as RiskLevel,
                                )
                            }
                        >
                            {levelOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </Field>
                    <Field label="Pemilik" error={form.errors.owner_id}>
                        <select
                            className={fieldClass}
                            value={form.data.owner_id}
                            onChange={(event) =>
                                form.setData('owner_id', event.target.value)
                            }
                        >
                            <option value="">Belum ditentukan</option>
                            {members.map((member) => (
                                <option key={member.id} value={member.id}>
                                    {member.name}
                                </option>
                            ))}
                        </select>
                    </Field>
                </div>
                <Field
                    label="Tugas terkait"
                    hint="(opsional)"
                    error={form.errors.task_id}
                >
                    <select
                        className={fieldClass}
                        value={form.data.task_id}
                        onChange={(event) =>
                            form.setData('task_id', event.target.value)
                        }
                    >
                        <option value="">Tidak ada</option>
                        {taskOptions.map((task) => (
                            <option key={task.id} value={task.id}>
                                {task.code} {task.title}
                            </option>
                        ))}
                    </select>
                </Field>
                {risk && (
                    <label className="flex min-h-11 items-center gap-2.5 text-[13px] text-text">
                        <input
                            type="checkbox"
                            className="size-4 accent-primary"
                            checked={form.data.status === 'resolved'}
                            onChange={(event) =>
                                form.setData(
                                    'status',
                                    event.target.checked ? 'resolved' : 'open',
                                )
                            }
                        />
                        Risiko sudah teratasi
                    </label>
                )}
            </form>
        </ResponsiveSheet>
    );
}
