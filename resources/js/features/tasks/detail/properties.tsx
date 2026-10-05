import { Link } from '@inertiajs/react';
import { CalendarDays, Clock3, Eye, EyeOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { PRIORITY_LABELS, PriorityIcon } from '@/components/priority-icon';
import { UserAvatar } from '@/components/shell/user-avatar';
import { StatusIcon } from '@/components/status-icon';
import { cn } from '@/lib/utils';
import { AvatarStack } from '../avatar-stack';
import { DueBadge } from '../due-badge';
import {
    AssigneePicker,
    DuePicker,
    LabelPicker,
    PriorityPicker,
    StatusPicker,
    pillClass,
} from '../form/pickers';
import { LabelPill } from '../label-pill';
import { formatDayMonth, formatShortDate } from '../lib/due-date';
import type { Priority } from '../types';
import { WorkspaceAvatar } from '@/features/workspaces/workspace-avatar';
import type { TaskDetailState } from './use-task-detail';
import type { TaskDetail } from './types';

type Size = 'default' | 'touch';

function Row({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="grid min-h-9 grid-cols-[120px_minmax(0,1fr)] items-center gap-3">
            <dt className="text-[13px] text-text-muted">{label}</dt>
            <dd className="min-w-0 text-[13px] text-text">{children}</dd>
        </div>
    );
}

/** Start date: native date input in a pill (no due-style wording). */
export function DateField({
    value,
    onChange,
    label,
    size = 'default',
}: {
    value: string | null;
    onChange: (date: string | null) => void;
    label: string;
    size?: Size;
}) {
    return (
        <label className={pillClass(size, 'relative cursor-pointer')}>
            <CalendarDays className="size-4" strokeWidth={1.75} aria-hidden />
            <span>{value ? formatShortDate(value) : 'Pilih tanggal'}</span>
            <input
                type="date"
                aria-label={label}
                value={value ?? ''}
                onChange={(event) =>
                    onChange(
                        event.target.value === '' ? null : event.target.value,
                    )
                }
                className="absolute inset-0 cursor-pointer opacity-0"
            />
        </label>
    );
}

export function EstimateField({
    value,
    onChange,
    size = 'default',
}: {
    value: number | null;
    onChange: (hours: number | null) => void;
    size?: Size;
}) {
    const [draft, setDraft] = useState(value === null ? '' : String(value));
    const [prev, setPrev] = useState(value);

    if (prev !== value) {
        setPrev(value);
        setDraft(value === null ? '' : String(value));
    }

    const commit = () => {
        const normalized = draft.replace(',', '.').trim();
        const next = normalized === '' ? null : Number(normalized);

        if (next !== null && (Number.isNaN(next) || next < 0 || next > 9999)) {
            setDraft(value === null ? '' : String(value));

            return;
        }

        if (next !== value) {
            onChange(next);
        }
    };

    return (
        <label className={pillClass(size, 'w-32')}>
            <Clock3
                className="size-4 shrink-0"
                strokeWidth={1.75}
                aria-hidden
            />
            <input
                inputMode="decimal"
                aria-label="Estimasi (jam)"
                placeholder="–"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={commit}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                        event.currentTarget.blur();
                    }
                }}
                className="w-12 min-w-0 bg-transparent text-right outline-none"
            />
            <span className="text-text-muted">jam</span>
        </label>
    );
}

type Props = {
    state: TaskDetailState & { detail: TaskDetail };
    today: string;
};

/**
 * Right column of the task detail (mockup TaskDetail "PROPERTI" / "DETAIL").
 * Pickers when the viewer may edit, plain values otherwise.
 */
export function PropertiesPanel({ state, today }: Props) {
    const { detail, viewer } = state;
    const { task, can } = detail;
    const status = detail.statuses.find((item) => item.id === task.status_id);
    const labels = detail.labels.filter((label) =>
        task.label_ids.includes(label.id),
    );
    const closed =
        task.status_category === 'done' || task.status_category === 'canceled';

    return (
        <div className="space-y-6">
            <section aria-labelledby="task-properties">
                <h2
                    id="task-properties"
                    className="mb-2 text-[11px] font-medium tracking-wide text-text-subtle uppercase"
                >
                    Properti
                </h2>
                <dl className="space-y-1">
                    <Row label="Status">
                        {can.edit ? (
                            <StatusPicker
                                statuses={detail.statuses}
                                value={task.status_id}
                                onChange={(id) => {
                                    const next = detail.statuses.find(
                                        (s) => s.id === id,
                                    );
                                    void state.update(
                                        { status_id: id },
                                        next
                                            ? {
                                                  task: {
                                                      ...task,
                                                      status_id: id,
                                                      status_category:
                                                          next.category,
                                                  },
                                              }
                                            : undefined,
                                    );
                                }}
                            />
                        ) : (
                            status && (
                                <span className="inline-flex items-center gap-2">
                                    <StatusIcon
                                        category={status.category}
                                        color={status.color}
                                    />
                                    {status.name}
                                </span>
                            )
                        )}
                    </Row>
                    <Row label="Prioritas">
                        {can.edit ? (
                            <PriorityPicker
                                value={task.priority}
                                onChange={(priority: Priority) =>
                                    void state.update({ priority })
                                }
                            />
                        ) : (
                            <span className="inline-flex items-center gap-2">
                                <PriorityIcon
                                    priority={task.priority}
                                    labelled={false}
                                />
                                {PRIORITY_LABELS[task.priority]}
                            </span>
                        )}
                    </Row>
                    <Row label="Penanggung jawab">
                        {can.edit ? (
                            <AssigneePicker
                                people={detail.members}
                                value={task.assignee_ids}
                                currentUserId={viewer?.id}
                                onChange={(ids) =>
                                    void state.update(
                                        { assignee_ids: ids },
                                        {
                                            assignees: detail.members.filter(
                                                (m) => ids.includes(m.id),
                                            ),
                                        },
                                    )
                                }
                            />
                        ) : detail.assignees.length === 0 ? (
                            <span className="text-text-muted">
                                Belum ditugaskan
                            </span>
                        ) : (
                            <span className="flex flex-wrap gap-2">
                                {detail.assignees.map((person) => (
                                    <span
                                        key={person.id}
                                        className="inline-flex items-center gap-1.5"
                                    >
                                        <UserAvatar
                                            name={person.name}
                                            src={person.avatar}
                                            className="size-5 text-[9px]"
                                        />
                                        {person.name}
                                    </span>
                                ))}
                            </span>
                        )}
                    </Row>
                    <Row label="Tenggat">
                        {can.edit ? (
                            <DuePicker
                                value={task.due_date}
                                today={today}
                                onChange={(due) =>
                                    void state.update({ due_date: due })
                                }
                            />
                        ) : task.due_date ? (
                            <DueBadge
                                due={task.due_date}
                                today={today}
                                closed={closed}
                                className="text-[13px]"
                            />
                        ) : (
                            <span className="text-text-muted">–</span>
                        )}
                    </Row>
                    <Row label="Mulai">
                        {can.edit ? (
                            <DateField
                                label="Tanggal mulai"
                                value={task.start_date}
                                onChange={(date) =>
                                    void state.update({ start_date: date })
                                }
                            />
                        ) : (
                            <span>
                                {task.start_date
                                    ? formatShortDate(task.start_date)
                                    : '–'}
                            </span>
                        )}
                    </Row>
                    <Row label="Estimasi">
                        {can.edit ? (
                            <EstimateField
                                value={task.estimate_hours}
                                onChange={(hours) =>
                                    void state.update({ estimate_hours: hours })
                                }
                            />
                        ) : (
                            <span>
                                {task.estimate_hours === null
                                    ? '–'
                                    : `${String(task.estimate_hours).replace('.', ',')} jam`}
                            </span>
                        )}
                    </Row>
                    <Row label="Label">
                        {can.edit ? (
                            <LabelPicker
                                labels={detail.labels}
                                value={task.label_ids}
                                onChange={(ids) =>
                                    void state.update({ label_ids: ids })
                                }
                            />
                        ) : labels.length === 0 ? (
                            <span className="text-text-muted">–</span>
                        ) : (
                            <span className="flex flex-wrap gap-1">
                                {labels.map((label) => (
                                    <LabelPill key={label.id} label={label} />
                                ))}
                            </span>
                        )}
                    </Row>
                </dl>
            </section>

            <section
                aria-labelledby="task-meta"
                className="border-t border-border pt-5"
            >
                <h2
                    id="task-meta"
                    className="mb-2 text-[11px] font-medium tracking-wide text-text-subtle uppercase"
                >
                    Detail
                </h2>
                <dl className="space-y-1">
                    <Row label="Workspace">
                        <Link
                            href={`/w/${detail.workspace.key}`}
                            className="inline-flex items-center gap-2 hover:underline"
                        >
                            <WorkspaceAvatar
                                name={detail.workspace.name}
                                type={detail.workspace.type}
                                color={detail.workspace.color}
                                className="size-5 text-[10px]"
                            />
                            <span className="truncate">
                                {detail.workspace.type === 'personal'
                                    ? 'Pribadi'
                                    : detail.workspace.name}
                            </span>
                        </Link>
                    </Row>
                    {detail.parent && (
                        <Row label="Induk">
                            <Link
                                href={`/w/${detail.workspace.key}/tasks/${detail.parent.key.split('-').pop()}`}
                                className="inline-flex items-center gap-2 hover:underline"
                            >
                                <StatusIcon
                                    category={detail.parent.status_category}
                                />
                                <span className="font-mono text-xs text-text-muted">
                                    {detail.parent.key}
                                </span>
                                <span className="truncate">
                                    {detail.parent.title}
                                </span>
                            </Link>
                        </Row>
                    )}
                    <Row label="Pengamat">
                        <span className="flex items-center gap-2">
                            {detail.watchers.length > 0 && (
                                <AvatarStack
                                    people={detail.watchers}
                                    max={4}
                                    size="md"
                                />
                            )}
                            <button
                                type="button"
                                onClick={() => void state.toggleWatch()}
                                aria-pressed={detail.watching}
                                aria-label={
                                    detail.watching
                                        ? 'Berhenti amati tugas ini'
                                        : 'Amati tugas ini'
                                }
                                title={
                                    detail.watching ? 'Berhenti amati' : 'Amati'
                                }
                                className={cn(
                                    'flex size-7 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-text-muted hover:text-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                                    detail.watching &&
                                        'border-solid border-primary/50 text-primary',
                                )}
                            >
                                {detail.watching ? (
                                    <EyeOff className="size-3.5" aria-hidden />
                                ) : (
                                    <Eye className="size-3.5" aria-hidden />
                                )}
                            </button>
                        </span>
                    </Row>
                    <Row label="Dibuat oleh">
                        {detail.creator ? (
                            <span className="inline-flex items-center gap-2">
                                <UserAvatar
                                    name={detail.creator.name}
                                    src={detail.creator.avatar}
                                    className="size-5 text-[9px]"
                                />
                                <span className="truncate">
                                    {detail.creator.name.split(' ')[0]} ·{' '}
                                    {formatDayMonth(
                                        task.created_at.slice(0, 10),
                                    )}
                                </span>
                            </span>
                        ) : (
                            '–'
                        )}
                    </Row>
                </dl>
            </section>
        </div>
    );
}
