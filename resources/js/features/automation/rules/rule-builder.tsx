import { Plus, Sparkles, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { SelectField, TextField } from '@/features/automation/form-fields';
import type { Option } from '@/features/automation/form-fields';
import { FormSurface } from '@/features/automation/form-surface';
import {
    ACTION_OPTIONS,
    CATEGORY_LABELS,
    CATEGORY_ORDER,
    CONDITION_OPTIONS,
    MAX_ACTIONS,
    PRIORITY_NAMES,
    ROLE_LABELS,
    TRIGGER_OPTIONS,
    decodeTarget,
    describeRule,
    emptyAction,
    emptyCondition,
    emptyTrigger,
    encodeTarget,
    hasErrors,
    validateRule,
} from '@/features/automation/rules';
import type { RuleContext, RuleDraft } from '@/features/automation/rules';
import type {
    AutomationRule,
    RoleKey,
    RuleAction,
    RuleCondition,
    RuleTrigger,
} from '@/features/automation/types';
import type { StatusCategory } from '@/features/tasks/types';
import { mutate } from '@/features/automation/mutation';
import type { RuleErrors } from '@/features/automation/rules';
import rulesRoutes from '@/routes/automation/rules';

const CATEGORY_OPTIONS: Option[] = CATEGORY_ORDER.map((c) => ({
    value: c,
    label: CATEGORY_LABELS[c],
}));

const PRIORITY_OPTIONS: Option[] = ([1, 2, 3, 4] as const).map((p) => ({
    value: String(p),
    label: PRIORITY_NAMES[p],
}));

function Step({ label, children }: { label: string; children: ReactNode }) {
    return (
        <fieldset className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-surface p-4">
            <legend className="px-1 text-overline text-link">{label}</legend>
            {children}
        </fieldset>
    );
}

/** Server validation keys (AutomationRuleRequest) → form errors. */
export function ruleErrorsFromServer(
    errors: Record<string, string>,
): RuleErrors {
    const result: RuleErrors = {};
    const actions: Record<number, string> = {};

    for (const [key, message] of Object.entries(errors)) {
        const action = /^actions\.(\d+)/.exec(key);

        if (key === 'name' || key === 'workspace_id') {
            result[key] = message;
        } else if (key.startsWith('trigger')) {
            result.trigger = message;
        } else if (key.startsWith('condition')) {
            result.condition = message;
        } else if (action) {
            actions[Number(action[1])] = message;
        } else if (key === 'actions') {
            result.actionsList = message;
        }
    }

    if (Object.keys(actions).length > 0) {
        result.actions = actions;
    }

    return result;
}

/**
 * "Aturan baru" / "Ubah aturan" — Jika (trigger) · Dan (optional condition)
 * · Maka (1–3 actions). `ctx.workspaces` = the workspaces the person
 * manages; people and labels are narrowed to the chosen workspace.
 */
export function RuleBuilder({
    open,
    onOpenChange,
    ctx,
    mobile,
    rule = null,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    ctx: RuleContext;
    mobile: boolean;
    /** Rule to edit; null = new rule. */
    rule?: AutomationRule | null;
}) {
    const [draft, setDraft] = useState<RuleDraft>(
        rule
            ? {
                  name: rule.name,
                  workspace_id: rule.workspace_id,
                  trigger: rule.trigger,
                  condition: rule.condition,
                  actions: rule.actions,
              }
            : {
                  name: '',
                  workspace_id: ctx.workspaces[0]?.id ?? '',
                  trigger: { type: 'task_moved', category: 'done' },
                  condition: null,
                  actions: [{ type: 'notify', target: null }],
              },
    );
    const [submitted, setSubmitted] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [serverErrors, setServerErrors] = useState<RuleErrors>({});
    const errors = submitted
        ? { ...serverErrors, ...validateRule(draft) }
        : serverErrors;
    const workspace = ctx.workspaces.find((w) => w.id === draft.workspace_id);
    const members = ctx.people.filter(
        (p) => !workspace?.member_ids || workspace.member_ids.includes(p.id),
    );

    const peopleOptions: Option[] = members.map((p) => ({
        value: p.id,
        label: p.name,
    }));
    const labelOptions: Option[] = ctx.labels
        .filter((l) => !l.workspace_id || l.workspace_id === draft.workspace_id)
        .map((l) => ({
            value: l.id,
            label: l.name,
        }));
    const targetOptions: Option[] = [
        {
            value: 'assignees',
            label: 'Penanggung jawab tugas',
            group: 'Dari tugas',
        },
        { value: 'watchers', label: 'Pengamat tugas', group: 'Dari tugas' },
        ...(Object.keys(ROLE_LABELS) as RoleKey[]).map((role) => ({
            value: `role:${role}`,
            label: ROLE_LABELS[role].replace(/^semua /, 'Semua '),
            group: 'Peran',
        })),
        ...members.map((p) => ({
            value: `user:${p.id}`,
            label: p.name,
            group: 'Orang',
        })),
    ];

    const setTrigger = (trigger: RuleTrigger) =>
        setDraft((d) => ({ ...d, trigger }));
    const setCondition = (condition: RuleCondition | null) =>
        setDraft((d) => ({ ...d, condition }));
    const setAction = (index: number, action: RuleAction) =>
        setDraft((d) => ({
            ...d,
            actions: d.actions.map((a, i) => (i === index ? action : a)),
        }));

    const save = () => {
        setSubmitted(true);
        setServerErrors({});

        if (hasErrors(validateRule(draft))) {
            return;
        }

        setProcessing(true);
        mutate(
            rule ? 'put' : 'post',
            rule ? rulesRoutes.update.url(rule.id) : rulesRoutes.store.url(),
            draft,
            {
                only: ['automation'],
                onSuccess: () => onOpenChange(false),
                onError: (server) =>
                    setServerErrors(ruleErrorsFromServer(server)),
                onFinish: () => setProcessing(false),
            },
        );
    };

    return (
        <FormSurface
            open={open}
            onOpenChange={onOpenChange}
            mobile={mobile}
            wide
            title={rule ? 'Ubah aturan' : 'Aturan baru'}
            description="Pilih pemicu, kondisi bila perlu, lalu apa yang dilakukan."
            footer={
                <>
                    <Button
                        variant="quiet"
                        onClick={() => onOpenChange(false)}
                        className="h-12 md:h-11"
                    >
                        Batal
                    </Button>
                    <Button
                        onClick={save}
                        disabled={processing}
                        className="h-12 md:h-11"
                    >
                        {processing ? 'Menyimpan…' : 'Simpan aturan'}
                    </Button>
                </>
            }
        >
            <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                    label="Nama aturan"
                    value={draft.name}
                    placeholder="Mis. Selesai → kabari Kadiv"
                    onChange={(name) => setDraft((d) => ({ ...d, name }))}
                    error={errors.name}
                />
                <SelectField
                    label="Workspace"
                    value={draft.workspace_id}
                    onChange={(workspace_id) =>
                        setDraft((d) => ({ ...d, workspace_id }))
                    }
                    options={ctx.workspaces.map((w) => ({
                        value: w.id,
                        label: `${w.key} · ${w.name}`,
                    }))}
                    error={errors.workspace_id}
                />
            </div>

            <Step label="Jika">
                <div className="grid gap-3 sm:grid-cols-2">
                    <SelectField
                        label="Pemicu"
                        value={draft.trigger.type}
                        onChange={(type) =>
                            setTrigger(
                                emptyTrigger(type as RuleTrigger['type']),
                            )
                        }
                        options={TRIGGER_OPTIONS}
                    />
                    {draft.trigger.type === 'task_moved' && (
                        <SelectField
                            label="Kategori kolom"
                            value={draft.trigger.category}
                            onChange={(category) =>
                                setTrigger({
                                    type: 'task_moved',
                                    category: category as StatusCategory,
                                })
                            }
                            options={CATEGORY_OPTIONS}
                            error={errors.trigger}
                        />
                    )}
                    {draft.trigger.type === 'task_created_with_label' && (
                        <SelectField
                            label="Label"
                            value={draft.trigger.label_id}
                            onChange={(label_id) =>
                                setTrigger({
                                    type: 'task_created_with_label',
                                    label_id,
                                })
                            }
                            options={labelOptions}
                            error={errors.trigger}
                        />
                    )}
                </div>
                <p className="text-meta text-text-muted">
                    Kategori dipakai, bukan nama kolom, supaya aturan tetap
                    jalan bila kolom diganti nama.
                </p>
            </Step>

            <Step label="Dan (opsional)">
                {draft.condition ? (
                    <div className="flex items-end gap-2">
                        <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                            <SelectField
                                label="Kondisi"
                                value={draft.condition.type}
                                onChange={(type) =>
                                    setCondition(
                                        emptyCondition(
                                            type as RuleCondition['type'],
                                        ),
                                    )
                                }
                                options={CONDITION_OPTIONS}
                            />
                            {draft.condition.type === 'priority' ? (
                                <SelectField
                                    label="Prioritas"
                                    value={
                                        draft.condition.priority
                                            ? String(draft.condition.priority)
                                            : null
                                    }
                                    onChange={(value) =>
                                        setCondition({
                                            type: 'priority',
                                            priority: Number(value) as
                                                | 1
                                                | 2
                                                | 3
                                                | 4,
                                        })
                                    }
                                    options={PRIORITY_OPTIONS}
                                    error={errors.condition}
                                />
                            ) : (
                                <SelectField
                                    label="Orang"
                                    value={draft.condition.user_id}
                                    onChange={(user_id) =>
                                        setCondition({
                                            type: 'assignee',
                                            user_id,
                                        })
                                    }
                                    options={peopleOptions}
                                    error={errors.condition}
                                />
                            )}
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Hapus kondisi"
                            onClick={() => setCondition(null)}
                            className={errors.condition ? 'mb-7' : undefined}
                        >
                            <X aria-hidden />
                        </Button>
                    </div>
                ) : (
                    <Button
                        variant="quiet"
                        className="self-start"
                        onClick={() => setCondition(emptyCondition('priority'))}
                    >
                        <Plus aria-hidden />
                        Tambah kondisi
                    </Button>
                )}
            </Step>

            <Step label="Maka">
                {draft.actions.map((action, index) => (
                    <div key={index} className="flex items-end gap-2">
                        <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                            <SelectField
                                label={`Aksi ${index + 1}`}
                                value={action.type}
                                onChange={(type) =>
                                    setAction(
                                        index,
                                        emptyAction(type as RuleAction['type']),
                                    )
                                }
                                options={ACTION_OPTIONS}
                            />
                            <ActionTarget
                                action={action}
                                error={errors.actions?.[index]}
                                onChange={(next) => setAction(index, next)}
                                targetOptions={targetOptions}
                                peopleOptions={peopleOptions}
                                labelOptions={labelOptions}
                            />
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Hapus aksi ${index + 1}`}
                            disabled={draft.actions.length === 1}
                            onClick={() =>
                                setDraft((d) => ({
                                    ...d,
                                    actions: d.actions.filter(
                                        (_, i) => i !== index,
                                    ),
                                }))
                            }
                            className={
                                errors.actions?.[index] ? 'mb-7' : undefined
                            }
                        >
                            <X aria-hidden />
                        </Button>
                    </div>
                ))}
                {errors.actionsList && (
                    <p
                        role="alert"
                        className="text-meta font-semibold text-danger"
                    >
                        {errors.actionsList}
                    </p>
                )}
                {draft.actions.length < MAX_ACTIONS && (
                    <Button
                        variant="quiet"
                        className="self-start"
                        onClick={() =>
                            setDraft((d) => ({
                                ...d,
                                actions: [
                                    ...d.actions,
                                    emptyAction('add_label'),
                                ],
                            }))
                        }
                    >
                        <Plus aria-hidden />
                        Tambah aksi
                    </Button>
                )}
            </Step>

            <div
                aria-live="polite"
                className="flex gap-3 rounded-lg bg-link-soft p-4 text-link"
            >
                <Sparkles aria-hidden className="mt-0.5 size-5 shrink-0" />
                <p className="text-[15px] leading-[22px] font-semibold">
                    {describeRule(ctx, draft)}
                </p>
            </div>
        </FormSurface>
    );
}

function ActionTarget({
    action,
    error,
    onChange,
    targetOptions,
    peopleOptions,
    labelOptions,
}: {
    action: RuleAction;
    error?: string;
    onChange: (action: RuleAction) => void;
    targetOptions: Option[];
    peopleOptions: Option[];
    labelOptions: Option[];
}) {
    switch (action.type) {
        case 'notify':
            return (
                <SelectField
                    label="Siapa"
                    value={encodeTarget(action.target)}
                    onChange={(value) =>
                        onChange({
                            type: 'notify',
                            target: decodeTarget(value),
                        })
                    }
                    options={targetOptions}
                    error={error}
                />
            );
        case 'assign':
            return (
                <SelectField
                    label="Kepada"
                    value={action.user_id}
                    onChange={(user_id) =>
                        onChange({ type: 'assign', user_id })
                    }
                    options={peopleOptions}
                    error={error}
                />
            );
        case 'add_label':
            return (
                <SelectField
                    label="Label"
                    value={action.label_id}
                    onChange={(label_id) =>
                        onChange({ type: 'add_label', label_id })
                    }
                    options={labelOptions}
                    error={error}
                />
            );
        case 'move_status':
            return (
                <SelectField
                    label="Kategori kolom"
                    value={action.category}
                    onChange={(category) =>
                        onChange({
                            type: 'move_status',
                            category: category as StatusCategory,
                        })
                    }
                    options={CATEGORY_OPTIONS}
                    error={error}
                />
            );
    }
}
