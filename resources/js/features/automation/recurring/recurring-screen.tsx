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
import { TODAY } from '@/features/automation/fixtures';
import {
    PageHeading,
    PreviewBar,
    PreviewError,
    PreviewSkeleton,
} from '@/features/automation/preview-state';
import type { PreviewState } from '@/features/automation/preview-state';
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
import { useFakeMutation } from '@/features/prototype/use-fake-mutation';
import { formatDate } from '@/lib/format';
import { palette } from '@/lib/palette';
import { cn } from '@/lib/utils';

function toForm(
    task: RecurringTask | null,
    defaults: { workspace_id: string },
): RecurringForm {
    return task
        ? {
              title: task.title,
              workspace_id: task.workspace_id,
              assignee_id: task.assignee_id ?? '',
              pattern: task.pattern,
              starts_on: task.starts_on,
              ends_on: task.ends_on ?? '',
          }
        : {
              title: '',
              workspace_id: defaults.workspace_id,
              assignee_id: '',
              pattern: { kind: 'weekly', weekdays: [1] },
              starts_on: TODAY,
              ends_on: '',
          };
}

export function nextRun(task: RecurringTask): string | null {
    return nextOccurrences(task, TODAY, 1)[0] ?? null;
}

export function RecurringScreen({
    props,
    state,
    mobile,
}: {
    props: RecurringProps;
    state: PreviewState;
    mobile: boolean;
}) {
    const [items, setItems] = useState<RecurringTask[]>(
        state === 'empty' ? [] : props.recurring,
    );
    const [editing, setEditing] = useState<RecurringTask | null>(null);
    const [open, setOpen] = useState(false);
    const [formKey, setFormKey] = useState(0);
    const { run } = useFakeMutation();

    const openForm = (task: RecurringTask | null) => {
        setEditing(task);
        setFormKey((k) => k + 1);
        setOpen(true);
    };

    const save = (values: RecurringForm) => {
        const patch = {
            title: values.title.trim(),
            workspace_id: values.workspace_id,
            assignee_id: values.assignee_id || null,
            pattern: values.pattern,
            starts_on: values.starts_on,
            ends_on: values.ends_on || null,
        };

        setItems((list) =>
            editing
                ? list.map((t) =>
                      t.id === editing.id ? { ...t, ...patch } : t,
                  )
                : [
                      {
                          ...patch,
                          id: `new-${Date.now()}`,
                          priority: 3,
                          is_active: true,
                          created_count: 0,
                          last_created_on: null,
                      },
                      ...list,
                  ],
        );
    };

    const toggle = (task: RecurringTask, on: boolean) =>
        void run(
            () =>
                setItems((list) =>
                    list.map((t) =>
                        t.id === task.id ? { ...t, is_active: on } : t,
                    ),
                ),
            {
                delay: 250,
                success: on
                    ? 'Dilanjutkan'
                    : 'Dijeda. Tugas tidak dibuat sampai dilanjutkan.',
            },
        );

    const createNow = (task: RecurringTask) => {
        const workspace = props.workspaces.find(
            (w) => w.id === task.workspace_id,
        );

        void run(
            () =>
                setItems((list) =>
                    list.map((t) =>
                        t.id === task.id
                            ? {
                                  ...t,
                                  created_count: t.created_count + 1,
                                  last_created_on: TODAY,
                              }
                            : t,
                    ),
                ),
            {
                success: `Tugas ${workspace?.key ?? ''}-${130 + task.created_count} "${task.title}" dibuat`,
            },
        );
    };

    const remove = (task: RecurringTask) =>
        void run(
            () => setItems((list) => list.filter((t) => t.id !== task.id)),
            {
                delay: 300,
                success: 'Dihapus. Tugas yang sudah dibuat tetap ada.',
            },
        );

    const newButton = (
        <Button onClick={() => openForm(null)}>
            <Plus aria-hidden />
            Tugas berulang baru
        </Button>
    );

    let body;

    if (state === 'loading') {
        body = <PreviewSkeleton />;
    } else if (state === 'error') {
        body = <PreviewError what="Tugas berulang" />;
    } else if (items.length === 0) {
        body = (
            <EmptyState
                icon={Repeat}
                title="Belum ada tugas berulang"
                description="Buat sekali, misalnya rekap stok tiap Senin, lalu tugasnya muncul sendiri di board."
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
                        onToggle={(on) => toggle(task, on)}
                        onEdit={() => openForm(task)}
                        onCreateNow={() => createNow(task)}
                        onDelete={() => remove(task)}
                    />
                ))}
            </ul>
        );

        body = mobile ? (
            <>
                <section
                    aria-label="Daftar tugas berulang"
                    className="overflow-hidden rounded-[22px] border border-border bg-surface"
                >
                    {rows}
                </section>
                <Fab
                    label="Tugas berulang baru"
                    onClick={() => openForm(null)}
                />
            </>
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

    return (
        <div className="flex flex-col gap-5 md:gap-6">
            <PreviewBar />
            <PageHeading
                title="Tugas berulang"
                description="Tugas rutin yang dibuat otomatis sesuai jadwal."
                actions={
                    !mobile && state === 'ready' && items.length > 0
                        ? newButton
                        : undefined
                }
            />
            <AutomationNav />
            {body}
            <RecurringFormSurface
                key={formKey}
                open={open}
                onOpenChange={setOpen}
                initial={toForm(editing, {
                    workspace_id: props.workspaces[0]?.id ?? '',
                })}
                editing={editing !== null}
                workspaces={props.workspaces}
                people={props.people}
                mobile={mobile}
                onSaved={save}
            />
        </div>
    );
}

function RecurringRow({
    task,
    props,
    onToggle,
    onEdit,
    onCreateNow,
    onDelete,
}: {
    task: RecurringTask;
    props: RecurringProps;
    onToggle: (on: boolean) => void;
    onEdit: () => void;
    onCreateNow: () => void;
    onDelete: () => void;
}) {
    const workspace = props.workspaces.find((w) => w.id === task.workspace_id);
    const assignee = props.people.find((p) => p.id === task.assignee_id);
    const next = task.is_active ? nextRun(task) : null;
    const tone = palette(workspace?.color);

    return (
        <li className="flex items-start gap-3.5 px-4 py-4 md:gap-4 md:px-7 lg:items-center">
            <Switch
                size="md"
                checked={task.is_active}
                onCheckedChange={onToggle}
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
                        <p className="text-[17px] leading-6 font-semibold text-text">
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
                    <span className="inline-flex items-center gap-2">
                        {assignee ? (
                            <>
                                <UserAvatar
                                    name={assignee.name}
                                    className="size-6 text-[11px]"
                                />
                                {assignee.name.split(' ')[0]}
                            </>
                        ) : (
                            'Belum ditugaskan'
                        )}
                    </span>
                    <span className="inline-flex items-center gap-1.5 tnum">
                        <CalendarClock aria-hidden className="size-4" />
                        {task.is_active
                            ? next
                                ? next === TODAY
                                    ? 'Hari ini'
                                    : formatDate(next)
                                : 'Selesai'
                            : 'Dijeda'}
                    </span>
                    <span className="tnum">{task.created_count}× dibuat</span>
                </div>
            </div>
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
                    <DropdownMenuItem onSelect={onCreateNow}>
                        <Play aria-hidden />
                        Buat sekarang
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                        <Trash2 aria-hidden />
                        Hapus
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </li>
    );
}
