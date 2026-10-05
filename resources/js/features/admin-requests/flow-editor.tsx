import { router } from '@inertiajs/react';
import { ArrowDown, ArrowUp, Eye, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { selectClass } from '@/features/requests/form-fields';
import { FlowChips } from '@/features/requests/request-parts';
import { formatDateTime } from '@/lib/format';
import { formatHours } from '@/lib/requests';
import { cn } from '@/lib/utils';
import {
    store as storeFlow,
    update as updateFlow,
} from '@/routes/admin/approval-flows';
import { preview as previewRoute } from '@/routes/admin/request-types';
import type { ApproverType } from '@/types/requests';
import { buildCondition, parseCondition, stepShortLabel } from './flow-summary';
import type {
    AdminFlow,
    AdminLeaveType,
    AdminOptions,
    FlowPreview,
    FlowStep,
} from './types';

type Props = {
    type: AdminLeaveType;
    flow: AdminFlow | undefined;
    types: AdminLeaveType[];
    options: AdminOptions;
    onDirtyChange: (dirty: boolean) => void;
};

const DEFAULT_STEPS: FlowStep[] = [
    {
        approver_type: 'direct_manager',
        approver_role: null,
        approver_user_id: null,
        condition: null,
    },
    {
        approver_type: 'role',
        approver_role: 'hr',
        approver_user_id: null,
        condition: null,
    },
];

/** Encodes the approver select ("direct_manager", "role:hr", "user"). */
function approverValue(step: FlowStep): string {
    return step.approver_type === 'role'
        ? `role:${step.approver_role ?? ''}`
        : step.approver_type;
}

export function FlowEditor({
    type,
    flow,
    types,
    options,
    onDirtyChange,
}: Props) {
    const initialSteps = flow?.steps.length ? flow.steps : DEFAULT_STEPS;
    const [steps, setSteps] = useState<FlowStep[]>(initialSteps);
    const [name, setName] = useState(flow?.name ?? `Alur ${type.name}`);
    const [skipSelf, setSkipSelf] = useState(flow?.skip_self_approval ?? true);
    const [allowDelegation, setAllowDelegation] = useState(
        flow?.allow_delegation ?? true,
    );
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [sampleId, setSampleId] = useState(options.users[0]?.id ?? '');
    const [preview, setPreview] = useState<FlowPreview | null>(null);

    const dirty = useMemo(
        () =>
            JSON.stringify(steps) !== JSON.stringify(initialSteps) ||
            name !== (flow?.name ?? `Alur ${type.name}`) ||
            skipSelf !== (flow?.skip_self_approval ?? true) ||
            allowDelegation !== (flow?.allow_delegation ?? true),
        [steps, name, skipSelf, allowDelegation, initialSteps, flow, type.name],
    );

    useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

    const sharedWith = types.filter(
        (other) =>
            other.id !== type.id && flow && other.approval_flow_id === flow.id,
    );

    useEffect(() => {
        if (!sampleId) {
            return;
        }

        const params = new URLSearchParams({
            leave_type_id: type.id,
            user_id: sampleId,
            skip_self_approval: skipSelf ? '1' : '0',
            allow_delegation: allowDelegation ? '1' : '0',
        });
        steps.forEach((step, index) => {
            params.set(`steps[${index}][approver_type]`, step.approver_type);
            params.set(
                `steps[${index}][approver_role]`,
                step.approver_role ?? '',
            );
            params.set(
                `steps[${index}][approver_user_id]`,
                step.approver_user_id ?? '',
            );
            Object.entries(step.condition ?? {}).forEach(([key, value]) =>
                params.set(`steps[${index}][condition][${key}]`, String(value)),
            );
        });

        const abort = new AbortController();
        const timer = window.setTimeout(() => {
            fetch(`${previewRoute.url()}?${params.toString()}`, {
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'same-origin',
                signal: abort.signal,
            })
                .then((response) =>
                    response.ok
                        ? (response.json() as Promise<FlowPreview>)
                        : null,
                )
                .then((data) => setPreview(data))
                .catch(() => undefined);
        }, 250);

        return () => {
            window.clearTimeout(timer);
            abort.abort();
        };
    }, [steps, sampleId, skipSelf, allowDelegation, type.id]);

    const patch = (index: number, changes: Partial<FlowStep>) =>
        setSteps((current) =>
            current.map((step, i) =>
                i === index ? { ...step, ...changes } : step,
            ),
        );
    const move = (index: number, delta: number) =>
        setSteps((current) => {
            const next = [...current];
            const [step] = next.splice(index, 1);
            next.splice(index + delta, 0, step);

            return next;
        });

    const reset = () => {
        setSteps(initialSteps);
        setName(flow?.name ?? `Alur ${type.name}`);
        setSkipSelf(flow?.skip_self_approval ?? true);
        setAllowDelegation(flow?.allow_delegation ?? true);
        setErrors({});
    };

    const save = () => {
        const data = {
            name,
            skip_self_approval: skipSelf,
            allow_delegation: allowDelegation,
            leave_type_id: type.id,
            steps: steps.map((step) => ({
                approver_type: step.approver_type,
                approver_role:
                    step.approver_type === 'role' ? step.approver_role : null,
                approver_user_id:
                    step.approver_type === 'user'
                        ? step.approver_user_id
                        : null,
                condition: step.condition,
            })),
        };
        const visitOptions = {
            preserveScroll: true,
            onStart: () => setSaving(true),
            onFinish: () => setSaving(false),
            onError: (e: Record<string, string>) => setErrors(e),
            onSuccess: () => setErrors({}),
        };

        // A type without its own flow (company default) gets a new flow; otherwise the flow is updated in place.
        if (flow && type.approval_flow_id === flow.id) {
            router.put(
                updateFlow.url({ approvalFlow: flow.id }),
                data,
                visitOptions,
            );
        } else {
            router.post(storeFlow.url(), data, visitOptions);
        }
    };

    const conditional = steps.filter((step) => step.condition).length;

    return (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
            <header className="border-b border-border px-5 py-4">
                <h2 className="text-[17px] font-semibold text-text">
                    Alur persetujuan · {type.name}
                </h2>
                <p className="text-[13px] text-text-muted">
                    {flow
                        ? `${flow.name}${flow.updated_at ? ` · diubah ${formatDateTime(flow.updated_at)}` : ''}`
                        : 'Memakai alur default (Atasan langsung → HR)'}{' '}
                    · {steps.length} langkah
                    {conditional > 0 ? `, ${conditional} bersyarat` : ''}
                </p>
                {sharedWith.length > 0 && (
                    <p className="mt-1 text-[13px] text-warning">
                        Alur ini dipakai juga oleh:{' '}
                        {sharedWith.map((t) => t.name).join(', ')}.
                    </p>
                )}
            </header>

            <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_280px]">
                <section aria-label="Langkah">
                    <h3 className="text-sm font-semibold text-text">Langkah</h3>
                    <p className="mb-3 text-[13px] text-text-muted">
                        Diproses berurutan. Cukup satu orang yang memegang peran
                        untuk menyetujui.
                    </p>

                    <ol className="space-y-3">
                        {steps.map((step, index) => {
                            const condition = parseCondition(step.condition);
                            const holders =
                                step.approver_type === 'role'
                                    ? (options.role_holders[
                                          step.approver_role ?? ''
                                      ] ?? [])
                                    : [];
                            const stepError = Object.entries(errors).find(
                                ([key]) => key.startsWith(`steps.${index}.`),
                            )?.[1];

                            return (
                                <li
                                    key={index}
                                    className="rounded-lg border border-border p-3"
                                >
                                    <div className="flex items-center gap-3">
                                        <span
                                            className={cn(
                                                'flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                                                condition
                                                    ? 'border-2 border-primary text-primary'
                                                    : 'bg-primary text-primary-foreground',
                                            )}
                                        >
                                            {index + 1}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium text-text">
                                                {stepShortLabel(step, options)}
                                                {step.approver_type ===
                                                    'role' && (
                                                    <span className="font-normal text-text-muted">
                                                        {' '}
                                                        (peran)
                                                    </span>
                                                )}
                                                {condition && (
                                                    <span className="ml-2 rounded-full bg-warning/10 px-2 py-0.5 text-xs text-warning">
                                                        Bersyarat
                                                    </span>
                                                )}
                                            </p>
                                            <p className="truncate text-[13px] text-text-muted">
                                                {step.approver_type ===
                                                    'direct_manager' &&
                                                    'Otomatis dari data karyawan'}
                                                {step.approver_type ===
                                                    'division_head' &&
                                                    'Kepala divisi pemohon'}
                                                {step.approver_type ===
                                                    'user' &&
                                                    'Selalu orang yang sama'}
                                                {step.approver_type ===
                                                    'role' &&
                                                    (holders.length === 0
                                                        ? 'Belum ada pemegang peran ini'
                                                        : `Dipegang ${holders.length} orang: ${holders.slice(0, 2).join(', ')}${holders.length > 2 ? '…' : ''}`)}
                                            </p>
                                        </div>
                                        <select
                                            aria-label={`Penyetuju langkah ${index + 1}`}
                                            className={cn(
                                                selectClass,
                                                'h-9 w-44',
                                            )}
                                            value={approverValue(step)}
                                            onChange={(event) => {
                                                const value =
                                                    event.target.value;
                                                const [kind, role] =
                                                    value.split(':') as [
                                                        ApproverType,
                                                        string | undefined,
                                                    ];
                                                patch(index, {
                                                    approver_type: kind,
                                                    approver_role: role ?? null,
                                                    approver_user_id:
                                                        kind === 'user'
                                                            ? (options.users[0]
                                                                  ?.id ?? null)
                                                            : null,
                                                });
                                            }}
                                        >
                                            <option value="direct_manager">
                                                Atasan langsung
                                            </option>
                                            <option value="division_head">
                                                Kepala divisi
                                            </option>
                                            {options.roles.map((role) => (
                                                <option
                                                    key={role.value}
                                                    value={`role:${role.value}`}
                                                >
                                                    Peran: {role.label}
                                                </option>
                                            ))}
                                            <option value="user">
                                                Orang tertentu
                                            </option>
                                        </select>
                                        <div className="flex">
                                            <button
                                                type="button"
                                                aria-label="Naikkan"
                                                disabled={index === 0}
                                                onClick={() => move(index, -1)}
                                                className="flex size-8 items-center justify-center rounded-md text-text-muted hover:bg-surface-2 disabled:opacity-30"
                                            >
                                                <ArrowUp
                                                    className="size-4"
                                                    aria-hidden
                                                />
                                            </button>
                                            <button
                                                type="button"
                                                aria-label="Turunkan"
                                                disabled={
                                                    index === steps.length - 1
                                                }
                                                onClick={() => move(index, 1)}
                                                className="flex size-8 items-center justify-center rounded-md text-text-muted hover:bg-surface-2 disabled:opacity-30"
                                            >
                                                <ArrowDown
                                                    className="size-4"
                                                    aria-hidden
                                                />
                                            </button>
                                            <button
                                                type="button"
                                                aria-label={`Hapus langkah ${index + 1}`}
                                                disabled={steps.length === 1}
                                                onClick={() =>
                                                    setSteps((current) =>
                                                        current.filter(
                                                            (_, i) =>
                                                                i !== index,
                                                        ),
                                                    )
                                                }
                                                className="flex size-8 items-center justify-center rounded-md text-text-muted hover:bg-surface-2 disabled:opacity-30"
                                            >
                                                <X
                                                    className="size-4"
                                                    aria-hidden
                                                />
                                            </button>
                                        </div>
                                    </div>

                                    {step.approver_type === 'user' && (
                                        <select
                                            aria-label="Karyawan penyetuju"
                                            className={cn(
                                                selectClass,
                                                'mt-3 ml-10 w-[calc(100%-2.5rem)]',
                                            )}
                                            value={step.approver_user_id ?? ''}
                                            onChange={(event) =>
                                                patch(index, {
                                                    approver_user_id:
                                                        event.target.value,
                                                })
                                            }
                                        >
                                            {options.users.map((user) => (
                                                <option
                                                    key={user.id}
                                                    value={user.id}
                                                >
                                                    {user.name}
                                                </option>
                                            ))}
                                        </select>
                                    )}

                                    {condition ? (
                                        <fieldset className="mt-3 ml-10 rounded-lg border border-dashed border-warning/60 bg-warning/5 p-3">
                                            <legend className="px-1 text-xs font-semibold tracking-wide text-warning uppercase">
                                                Kondisi
                                            </legend>
                                            <div className="flex flex-wrap items-center gap-2 text-sm">
                                                <span>Hanya jika</span>
                                                <select
                                                    aria-label="Metrik kondisi"
                                                    className={cn(
                                                        selectClass,
                                                        'w-auto',
                                                    )}
                                                    value={condition.metric}
                                                    onChange={(event) =>
                                                        patch(index, {
                                                            condition:
                                                                buildCondition(
                                                                    event.target
                                                                        .value,
                                                                    condition.operator,
                                                                    condition.value,
                                                                ),
                                                        })
                                                    }
                                                >
                                                    {options.metrics.map(
                                                        (metric) => (
                                                            <option
                                                                key={
                                                                    metric.value
                                                                }
                                                                value={
                                                                    metric.value
                                                                }
                                                            >
                                                                {metric.label}
                                                            </option>
                                                        ),
                                                    )}
                                                </select>
                                                <select
                                                    aria-label="Operator"
                                                    className={cn(
                                                        selectClass,
                                                        'w-16',
                                                    )}
                                                    value={condition.operator}
                                                    onChange={(event) =>
                                                        patch(index, {
                                                            condition:
                                                                buildCondition(
                                                                    condition.metric,
                                                                    event.target
                                                                        .value,
                                                                    condition.value,
                                                                ),
                                                        })
                                                    }
                                                >
                                                    <option value="gt">
                                                        &gt;
                                                    </option>
                                                    <option value="gte">
                                                        ≥
                                                    </option>
                                                    <option value="lt">
                                                        &lt;
                                                    </option>
                                                    <option value="lte">
                                                        ≤
                                                    </option>
                                                </select>
                                                <Input
                                                    aria-label="Nilai"
                                                    type="number"
                                                    min={0}
                                                    step={0.5}
                                                    className="w-20"
                                                    value={condition.value}
                                                    onChange={(event) =>
                                                        patch(index, {
                                                            condition:
                                                                buildCondition(
                                                                    condition.metric,
                                                                    condition.operator,
                                                                    Number(
                                                                        event
                                                                            .target
                                                                            .value,
                                                                    ),
                                                                ),
                                                        })
                                                    }
                                                />
                                                <span>
                                                    {options.metrics.find(
                                                        (metric) =>
                                                            metric.value ===
                                                            condition.metric,
                                                    )?.unit ?? 'jam'}
                                                </span>
                                                <button
                                                    type="button"
                                                    className="ml-auto text-[13px] text-text-muted hover:underline"
                                                    onClick={() =>
                                                        patch(index, {
                                                            condition: null,
                                                        })
                                                    }
                                                >
                                                    Hapus kondisi
                                                </button>
                                            </div>
                                            <p className="mt-2 text-[13px] text-warning">
                                                Selain itu, langkah dilewati.
                                            </p>
                                        </fieldset>
                                    ) : (
                                        <button
                                            type="button"
                                            className="mt-2 ml-10 text-[13px] text-primary hover:underline"
                                            onClick={() =>
                                                patch(index, {
                                                    condition: buildCondition(
                                                        'overtime_month_minutes',
                                                        'gt',
                                                        40,
                                                    ),
                                                })
                                            }
                                        >
                                            + Tambah kondisi
                                        </button>
                                    )}
                                    <InputError
                                        message={stepError}
                                        className="mt-2 ml-10"
                                    />
                                </li>
                            );
                        })}
                    </ol>

                    <button
                        type="button"
                        disabled={steps.length >= 8}
                        onClick={() =>
                            setSteps((current) => [
                                ...current,
                                {
                                    approver_type: 'role',
                                    approver_role: 'direksi',
                                    approver_user_id: null,
                                    condition: null,
                                },
                            ])
                        }
                        className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong text-sm text-text hover:bg-surface-2 disabled:opacity-50"
                    >
                        <Plus className="size-4" aria-hidden /> Tambah langkah
                    </button>
                    <InputError message={errors.steps} className="mt-2" />
                </section>

                <section aria-label="Pengaturan" className="space-y-5">
                    <h3 className="text-sm font-semibold text-text">
                        Pengaturan
                    </h3>
                    <div className="grid gap-2">
                        <Label htmlFor="flow-name">Nama alur</Label>
                        <Input
                            id="flow-name"
                            value={name}
                            maxLength={120}
                            onChange={(event) => setName(event.target.value)}
                        />
                        <InputError message={errors.name} />
                    </div>
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-sm text-text">
                                Lewati langkah bila penyetuju = pemohon
                            </p>
                            <p className="text-[13px] text-text-muted">
                                Mati: naik ke atasan pemohon. Mis. kepala divisi
                                yang mengajukan lembur sendiri.
                            </p>
                        </div>
                        <Switch
                            aria-label="Lewati langkah bila penyetuju = pemohon"
                            checked={skipSelf}
                            onCheckedChange={setSkipSelf}
                        />
                    </div>
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-sm text-text">
                                Izinkan delegasi saat penyetuju cuti
                            </p>
                            <p className="text-[13px] text-text-muted">
                                Diteruskan ke pengganti yang ditunjuk saat cuti.
                            </p>
                        </div>
                        <Switch
                            aria-label="Izinkan delegasi saat penyetuju cuti"
                            checked={allowDelegation}
                            onCheckedChange={setAllowDelegation}
                        />
                    </div>
                    <p className="text-[13px] text-text-muted">
                        Lampiran wajib diatur lewat “Ubah jenis”.
                    </p>
                </section>
            </div>

            <section
                aria-label="Pratinjau"
                className="mx-5 mb-5 rounded-lg bg-surface-2/70 p-4"
            >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-2 text-sm text-text">
                        <Eye className="size-4 text-text-muted" aria-hidden />
                        <strong className="font-semibold">Pratinjau</strong>
                        {preview && (
                            <span>
                                {preview.sample.name}
                                {type.category === 'overtime'
                                    ? `, total ${formatHours(preview.overtime_month_minutes)} bulan ini`
                                    : ''}{' '}
                                →{' '}
                                {
                                    preview.steps.filter(
                                        (step) => step.status !== 'skipped',
                                    ).length
                                }{' '}
                                langkah
                            </span>
                        )}
                    </p>
                    <select
                        aria-label="Contoh karyawan"
                        className={cn(selectClass, 'w-56 bg-surface')}
                        value={sampleId}
                        onChange={(event) => setSampleId(event.target.value)}
                    >
                        {options.users.map((user) => (
                            <option key={user.id} value={user.id}>
                                Contoh: {user.name}
                            </option>
                        ))}
                    </select>
                </div>
                {preview ? (
                    <FlowChips steps={preview.steps} />
                ) : (
                    <p className="text-[13px] text-text-muted">
                        Memuat pratinjau…
                    </p>
                )}
            </section>

            <footer className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
                <p className="text-[13px] text-text-muted">
                    Berlaku untuk pengajuan baru. Pengajuan yang sedang berjalan
                    tetap memakai alur lama.
                </p>
                <div className="flex shrink-0 gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        disabled={!dirty || saving}
                        onClick={reset}
                    >
                        Batal
                    </Button>
                    <Button type="button" disabled={saving} onClick={save}>
                        Simpan alur
                    </Button>
                </div>
            </footer>
        </div>
    );
}
