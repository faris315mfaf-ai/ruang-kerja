import { router } from '@inertiajs/react';
import { ArrowDown, ArrowUp, Eye, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { NativeSelect } from '@/features/admin/native-select';
import { ProvisionalBadge } from '@/features/requests/form-fields';
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
    const [sampleId, setSampleId] = useState(
        options.default_sample_id ?? options.users[0]?.id ?? '',
    );
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
        <section
            aria-labelledby="flow-editor-title"
            className="flex min-w-0 flex-col rounded-panel border border-border bg-surface shadow-card"
        >
            <header className="flex flex-col gap-1 border-b border-divider px-6 pt-6 pb-5 md:px-7">
                <h2
                    id="flow-editor-title"
                    className="flex flex-wrap items-center gap-2.5 pr-12 text-h3"
                >
                    Alur persetujuan · {type.name}
                    {type.is_provisional_default && <ProvisionalBadge />}
                </h2>
                <p className="text-meta text-text-muted">
                    {flow
                        ? `${flow.name}${flow.updated_at ? ` · diubah ${formatDateTime(flow.updated_at)}` : ''}`
                        : 'Memakai alur default (Atasan langsung → HR)'}{' '}
                    · {steps.length} langkah
                    {conditional > 0 ? `, ${conditional} bersyarat` : ''}
                </p>
                {sharedWith.length > 0 && (
                    <p className="text-meta font-semibold text-warning">
                        Alur ini dipakai juga oleh:{' '}
                        {sharedWith.map((t) => t.name).join(', ')}.
                    </p>
                )}
            </header>

            <div className="grid gap-7 px-6 py-6 md:px-7 xl:grid-cols-[minmax(0,1fr)_300px]">
                <section aria-labelledby="flow-steps-title">
                    <h3 id="flow-steps-title" className="text-title">
                        Langkah
                    </h3>
                    <p className="mb-4 text-meta text-text-muted">
                        Diproses berurutan. Cukup satu orang yang memegang peran
                        untuk menyetujui.
                    </p>

                    <ol className="flex flex-col gap-3">
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
                                    className="rounded-lg border border-border bg-surface p-4"
                                >
                                    <div className="flex flex-wrap items-center gap-3">
                                        <span
                                            className={cn(
                                                'flex size-8 shrink-0 items-center justify-center rounded-full text-[15px] font-bold tnum',
                                                condition
                                                    ? 'border-2 border-dashed border-link text-link'
                                                    : 'bg-link-soft text-link',
                                            )}
                                        >
                                            {index + 1}
                                        </span>
                                        <div className="min-w-[180px] flex-1">
                                            <p className="flex flex-wrap items-center gap-2 text-[16px] font-semibold">
                                                <span>
                                                    {stepShortLabel(
                                                        step,
                                                        options,
                                                    )}
                                                    {step.approver_type ===
                                                        'role' && (
                                                        <span className="font-normal text-text-muted">
                                                            {' '}
                                                            (peran)
                                                        </span>
                                                    )}
                                                </span>
                                                {condition && (
                                                    <Badge
                                                        variant="status"
                                                        tone="warning"
                                                        className="h-[26px] px-2.5 text-[13px]"
                                                    >
                                                        Bersyarat
                                                    </Badge>
                                                )}
                                            </p>
                                            <p className="truncate text-meta text-text-muted">
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
                                        <NativeSelect
                                            size="sm"
                                            aria-label={`Penyetuju langkah ${index + 1}`}
                                            className="w-48"
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
                                        </NativeSelect>
                                        <div className="flex gap-0.5">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon-sm"
                                                aria-label="Naikkan"
                                                disabled={index === 0}
                                                onClick={() => move(index, -1)}
                                            >
                                                <ArrowUp aria-hidden />
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon-sm"
                                                aria-label="Turunkan"
                                                disabled={
                                                    index === steps.length - 1
                                                }
                                                onClick={() => move(index, 1)}
                                            >
                                                <ArrowDown aria-hidden />
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon-sm"
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
                                            >
                                                <X aria-hidden />
                                            </Button>
                                        </div>
                                    </div>

                                    {step.approver_type === 'user' && (
                                        <NativeSelect
                                            size="sm"
                                            aria-label="Karyawan penyetuju"
                                            className="mt-3 ml-11"
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
                                        </NativeSelect>
                                    )}

                                    {condition ? (
                                        <fieldset className="mt-3 ml-11 rounded-control border border-dashed border-warning/60 bg-warning-soft/50 p-3">
                                            <legend className="px-1 text-overline text-warning">
                                                Kondisi
                                            </legend>
                                            <div className="flex flex-wrap items-center gap-2 text-[15px]">
                                                <span>Hanya jika</span>
                                                <NativeSelect
                                                    size="sm"
                                                    aria-label="Metrik kondisi"
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
                                                </NativeSelect>
                                                <NativeSelect
                                                    size="sm"
                                                    aria-label="Operator"
                                                    className="w-20"
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
                                                </NativeSelect>
                                                <Input
                                                    aria-label="Nilai"
                                                    type="number"
                                                    min={0}
                                                    step={0.5}
                                                    className="h-9 w-24 rounded-[10px] text-[15px]"
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
                                                <Button
                                                    type="button"
                                                    variant="quiet"
                                                    size="sm"
                                                    className="ml-auto"
                                                    onClick={() =>
                                                        patch(index, {
                                                            condition: null,
                                                        })
                                                    }
                                                >
                                                    Hapus kondisi
                                                </Button>
                                            </div>
                                            <p className="mt-2 text-meta font-semibold text-warning">
                                                Selain itu, langkah dilewati.
                                            </p>
                                        </fieldset>
                                    ) : (
                                        <Button
                                            type="button"
                                            variant="quiet"
                                            size="sm"
                                            className="mt-2 ml-9"
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
                                            <Plus aria-hidden /> Tambah kondisi
                                        </Button>
                                    )}
                                    <InputError
                                        message={stepError}
                                        className="mt-2 ml-11"
                                    />
                                </li>
                            );
                        })}
                    </ol>

                    <Button
                        type="button"
                        variant="outline"
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
                        className="mt-3 w-full border-dashed"
                    >
                        <Plus aria-hidden /> Tambah langkah
                    </Button>
                    <InputError message={errors.steps} className="mt-2" />
                </section>

                <section
                    aria-labelledby="flow-settings-title"
                    className="flex flex-col gap-5"
                >
                    <h3 id="flow-settings-title" className="text-title">
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
                    <div className="divide-y divide-divider rounded-lg border border-border">
                        <SwitchRow
                            title="Lewati langkah bila penyetuju = pemohon"
                            note="Mati: naik ke atasan pemohon. Mis. kepala divisi yang mengajukan lembur sendiri."
                            checked={skipSelf}
                            onCheckedChange={setSkipSelf}
                        />
                        <SwitchRow
                            title="Izinkan delegasi saat penyetuju cuti"
                            note="Diteruskan ke pengganti yang ditunjuk saat cuti."
                            checked={allowDelegation}
                            onCheckedChange={setAllowDelegation}
                        />
                    </div>
                    <p className="text-meta text-text-muted">
                        Lampiran wajib diatur lewat “Ubah jenis”.
                    </p>
                </section>
            </div>

            <section
                aria-label="Pratinjau"
                className="mx-6 mb-6 flex flex-col gap-3 rounded-[18px] bg-background p-4 md:mx-7"
            >
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="flex flex-wrap items-center gap-2 text-[15px]">
                        <Eye className="size-5 text-link" aria-hidden />
                        <strong className="font-bold">Pratinjau</strong>
                        {preview && (
                            <span className="text-text-muted">
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
                    <NativeSelect
                        aria-label="Contoh karyawan"
                        className="w-64"
                        value={sampleId}
                        onChange={(event) => setSampleId(event.target.value)}
                    >
                        {options.users.map((user) => (
                            <option key={user.id} value={user.id}>
                                Contoh: {user.name}
                            </option>
                        ))}
                    </NativeSelect>
                </div>
                {preview ? (
                    <FlowChips steps={preview.steps} />
                ) : (
                    <div aria-busy className="flex gap-2">
                        <span className="sr-only">Memuat pratinjau…</span>
                        <Skeleton className="h-9 w-40 rounded-full" />
                        <Skeleton className="h-9 w-40 rounded-full" />
                    </div>
                )}
            </section>

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-divider px-6 py-4 md:px-7">
                <p className="max-w-[520px] text-meta text-text-muted">
                    Berlaku untuk pengajuan baru. Pengajuan yang sedang berjalan
                    tetap memakai alur lama.
                </p>
                <div className="flex shrink-0 gap-3">
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
        </section>
    );
}

/** Setting row: title + note left, switch right (SPengaturan style). */
function SwitchRow({
    title,
    note,
    checked,
    onCheckedChange,
}: {
    title: string;
    note: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
}) {
    return (
        <div className="flex items-start justify-between gap-3 p-4">
            <div className="flex flex-col gap-0.5">
                <p className="text-[15px] font-semibold">{title}</p>
                <p className="text-meta text-text-muted">{note}</p>
            </div>
            <Switch
                aria-label={title}
                checked={checked}
                onCheckedChange={onCheckedChange}
            />
        </div>
    );
}
