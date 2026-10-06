import {
    CalendarClock,
    MoreHorizontal,
    Pencil,
    Play,
    Plus,
    Repeat,
    Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Fab } from '@/components/mobile/fab';
import { PriorityIcon } from '@/components/priority-icon';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Panel } from '@/components/ui/panel';
import { Switch } from '@/components/ui/switch';
import { AutomationNav } from '@/features/automation/automation-nav';
import { ConfirmDelete } from '@/features/automation/confirm-delete';
import { mutate } from '@/features/automation/mutation';
import { PageHeading } from '@/features/automation/preview-state';
import {
    describePattern,
    nextOccurrences,
} from '@/features/automation/recurrence';
import type { RecurringForm } from '@/features/automation/recurrence';
import { RecurringFormSurface } from '@/features/automation/recurring/recurring-form';
import type {
    RecurringProps,
    RecurringTask,
} from '@/features/automation/types';
import { formatDate } from '@/lib/format';
import { palette } from '@/lib/palette';
import { cn } from '@/lib/utils';
import recurringRoutes from '@/routes/automation/recurring';

const ONLY = ['recurring'];

function toForm(
    task: RecurringTask | null,
    defaults: { workspace_id: string; today: string },
): RecurringForm {
    return task
        ? {
              title: task.title,
              workspace_id: task.workspace_id,
              assignee_id: task.assignee_id ?? '',
              priority: task.priority,
              pattern: task.pattern,
              starts_on: task.starts_on,
              ends_on: task.ends_on ?? '',
          }
        : {
              title: '',
              workspace_id: defaults.workspace_id,
              assignee_id: '',
              priority: 3,
              pattern: { kind: 'weekly', weekdays: [1] },
              starts_on: defaults.today,
              ends_on: '',
          };
}

/** Next creation date from today (null when the schedule has ended). */
export function nextRun(task: RecurringTask, today: string): string | null {
    return nextOccurrences(task, today, 1)[0] ?? null;
}

/**
 * /otomasi/berulang — recurring tasks of the person's workspaces. Members
 * who may create tasks add them; the creator or an owner/admin changes,
 * pauses, runs ("Buat sekarang") and deletes (RecurringTaskPolicy).
 */
export function RecurringScreen({
    props,
    mobile,
}: {
    props: RecurringProps;
    mobile: boolean;
}) {
    const [pending, setPending] = useState<Record<string, boolean>>({});
    const items = props.recurring.map((task) =>
        task.id in pending ? { ...task, is_active: pending[task.id] } : task,
    );
    const [editing, setEditing] = useState<RecurringTask | null>(null);
    const [open, setOpen] = useState(false);
    const [formKey, setFormKey] = useState(0);
    const [deleting, setDeleting] = useState<RecurringTask | null>(null);
    const [removing, setRemoving] = useState(false);
    const [running, setRunning] = useState<string | null>(null);
    const creatable = props.workspaces.filter((w) => w.can_edit_tasks);

    const openForm = (task: RecurringTask | null) => {
        setEditing(task);
        setFormKey((k) => k + 1);
        setOpen(true);
    };

    const toggle = (task: RecurringTask, on: boolean) => {
        setPending((map) => ({ ...map, [task.id]: on }));
        mutate(
            'patch',
            recurringRoutes.active.url(task.id),
            { is_active: on },
            {
                only: ONLY,
                onFinish: () =>
                    setPending((map) => {
                        const next = { ...map };
                        delete next[task.id];

                        return next;
                    }),
            },
        );
    };

    const createNow = (task: RecurringTask) => {
        setRunning(task.id);
        mutate(
            'post',
            recurringRoutes.run.url(task.id),
            {},
            { only: ONLY, onFinish: () => setRunning(null) },
        );
    };

    const remove = () => {
        if (!deleting) {
            return;
        }

        setRemoving(true);
        mutate(
            'delete',
            recurringRoutes.destroy.url(deleting.id),
            {},
            {
                only: ONLY,
                onSuccess: () => setDeleting(null),
                onFinish: () => setRemoving(false),
            },
        );
    };

    const newButton =
        creatable.length > 0 ? (
            <Button onClick={() => openForm(null)}>
                <Plus aria-hidden />
                Tugas berulang baru
            </Button>
        ) : undefined;

    let body;

    if (items.length === 0) {
        body = (
            <EmptyState
                icon={Repeat}
                title="Belum ada tugas berulang"
                description="Buat sekali, misalnya rekap stok tiap Senin, lalu tugasnya muncul sendiri di board pukul 07.00."
                action={newButton}
            />
        );
    } else {
        const rows = (
            <ul className="divide-y divide-divider">
                {items.map((task) => (
                    <RecurringRow
                        key={task.id}
                        task={task}
                        props={props}
                        running={running === task.id}
                        onToggle={(on) => toggle(task, on)}
                        onEdit={() => openForm(task)}
                        onCreateNow={() => createNow(task)}
                        onDelete={() => setDeleting(task)}
                    />
                ))}
            </ul>
        );

        body = mobile ? (
            <section
                aria-label="Daftar tugas berulang"
                className="overflow-hidden rounded-[22px] border border-border bg-surface"
            >
                {rows}
            </section>
        ) : (
            <Panel
                title="Tugas berulang"
                action={
                    <span className="text-[15px] text-text-muted">
                        {items.filter((t) => t.is_active).length} aktif
                    </span>
                }
                flush
                className="pb-2"
            >
                {rows}
            </Panel>
        );
    }

    const formWorkspaces = editing
        ? props.workspaces.filter(
              (w) => w.can_edit_tasks || w.id === editing.workspace_id,
          )
        : creatable;

    return (
        <div className="flex flex-col gap-5 md:gap-6">
            <PageHeading
                title="Tugas berulang"
                description="Tugas rutin yang dibuat otomatis pukul 07.00 sesuai jadwal."
                actions={!mobile && items.length > 0 ? newButton : undefined}
            />
            <AutomationNav />
            {body}
            {mobile && items.length > 0 && creatable.length > 0 && (
                <Fab
                    label="Tugas berulang baru"
                    onClick={() => openForm(null)}
                />
            )}
            {open && (
                <RecurringFormSurface
                    key={formKey}
                    open={open}
                    onOpenChange={setOpen}
                    initial={toForm(editing, {
                        workspace_id: creatable[0]?.id ?? '',
                        today: props.today,
                    })}
                    editingId={editing?.id ?? null}
                    workspaces={formWorkspaces}
                    people={props.people}
                    today={props.today}
                    mobile={mobile}
                />
            )}
            <ConfirmDelete
                open={deleting !== null}
                onOpenChange={(next) => !next && setDeleting(null)}
                title={`Hapus "${deleting?.title ?? ''}"?`}
                description="Jadwalnya berhenti. Tugas yang sudah dibuat tetap ada di board."
                processing={removing}
                mobile={mobile}
                onConfirm={remove}
            />
        </div>
    );
}

function RecurringRow({
    task,
    props,
    running,
    onToggle,
    onEdit,
    onCreateNow,
    onDelete,
}: {
    task: RecurringTask;
    props: RecurringProps;
    running: boolean;
    onToggle: (on: boolean) => void;
    onEdit: () => void;
    onCreateNow: () => void;
    onDelete: () => void;
}) {
    const workspace = props.workspaces.find((w) => w.id === task.workspace_id);
    const assignee = props.people.find((p) => p.id === task.assignee_id);
    const next = task.is_active ? nextRun(task, props.today) : null;
    const tone = palette(workspace?.color);

    return (
        <li className="flex items-start gap-3.5 px-4 py-4 md:gap-4 md:px-7 lg:items-center">
            <Switch
                size="md"
                checked={task.is_active}
                onCheckedChange={onToggle}
                disabled={!task.can_manage}
                aria-label={`Aktifkan ${task.title}`}
                className="mt-0.5 lg:mt-0"
            />
            <div
                className={cn(
                    'flex min-w-0 flex-1 flex-col gap-1 lg:flex-row lg:items-center lg:gap-5',
                    !task.is_active && 'opacity-70',
                )}
            >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <PriorityIcon priority={task.priority} />
                        <p className="min-w-0 text-[17px] leading-6 font-semibold break-words text-text">
                            {task.title}
                        </p>
                        {workspace && (
                            <Badge
                                variant="label"
                                className={cn(
                                    tone.soft,
                                    tone.text,
                                    'h-6 px-2 text-[13px]',
                                )}
                            >
                                {workspace.key}
                            </Badge>
                        )}
                    </div>
                    <p className="flex items-center gap-1.5 text-[15px] text-text-muted">
                        <Repeat aria-hidden className="size-4 shrink-0" />
                        {describePattern(task.pattern)}
                        {task.ends_on &&
                            ` · sampai ${formatDate(task.ends_on)}`}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-meta text-text-muted lg:w-[360px] lg:shrink-0 lg:justify-end">
                    <span className="inline-flex min-w-0 items-center gap-2">
                        {assignee ? (
                            <>
                                <UserAvatar
                                    name={assignee.name}
                                    className="size-6 text-[11px]"
                                />
                                <span className="truncate">
                                    {assignee.name.split(' ')[0]}
                                </span>
                            </>
                        ) : (
                            'Belum ditugaskan'
                        )}
                    </span>
                    <span className="inline-flex items-center gap-1.5 tnum">
                        <CalendarClock aria-hidden className="size-4" />
                        {task.is_active
                            ? next
                                ? next === props.today
                                    ? 'Hari ini'
                                    : formatDate(next)
                                : 'Selesai'
                            : 'Dijeda'}
                    </span>
                    <span className="tnum">{task.created_count}× dibuat</span>
                </div>
            </div>
            {task.can_manage && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Menu ${task.title}`}
                            className="-mt-1 -mr-2 lg:mt-0"
                        >
                            <MoreHorizontal aria-hidden />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={onEdit}>
                            <Pencil aria-hidden />
                            Ubah
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onSelect={onCreateNow}
                            disabled={running}
                        >
                            <Play aria-hidden />
                            {running ? 'Membuat…' : 'Buat sekarang'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            variant="destructive"
                            onSelect={onDelete}
                        >
                            <Trash2 aria-hidden />
                            Hapus
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
        </li>
    );
}
