import { router, useForm } from '@inertiajs/react';
import { ChevronDown, Plus, RefreshCw, Trash2 } from 'lucide-react';
import type { FormEvent } from 'react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { WorkspaceAvatar } from '@/features/workspaces/workspace-avatar';
import { cn } from '@/lib/utils';
import { destroy, store, update } from '@/routes/tasks';
import type { Priority, Task, WorkspaceTaskOptions } from '../types';
import {
    AssigneePicker,
    DuePicker,
    LabelPicker,
    PriorityPicker,
    StatusPicker,
    pillClass,
    quickDueOptions,
} from './pickers';

export type TaskFormDefaults = {
    statusId?: string;
};

type Props = {
    variant: 'dialog' | 'sheet';
    options: WorkspaceTaskOptions;
    /** All workspaces the user can create in (workspace switcher). */
    workspaces?: WorkspaceTaskOptions[] | null;
    onWorkspaceChange?: (key: string) => void;
    task?: Task;
    defaults?: TaskFormDefaults;
    today: string;
    currentUserId?: string;
    canDelete?: boolean;
    onDone: () => void;
};

type FormData = {
    title: string;
    description_text: string;
    status_id: string;
    priority: Priority;
    assignee_ids: string[];
    label_ids: string[];
    due_date: string | null;
};

function initial(
    options: WorkspaceTaskOptions,
    task: Task | undefined,
    defaults: TaskFormDefaults | undefined,
    currentUserId: string | undefined,
): FormData {
    if (task) {
        return {
            title: task.title,
            description_text: task.description_text ?? '',
            status_id: task.status_id,
            priority: task.priority,
            assignee_ids: task.assignee_ids,
            label_ids: task.label_ids,
            due_date: task.due_date,
        };
    }

    const todo =
        options.statuses.find((status) => status.id === defaults?.statusId) ??
        options.statuses.find((status) => status.category === 'todo') ??
        options.statuses[0];
    const isMember = options.members.some(
        (member) => member.id === currentUserId,
    );

    return {
        title: '',
        description_text: '',
        status_id: todo?.id ?? '',
        priority: 0,
        assignee_ids: isMember && currentUserId ? [currentUserId] : [],
        label_ids: [],
        due_date: null,
    };
}

/**
 * Task form shared by the desktop dialog and the mobile bottom sheet
 * (mockup MTugasBaru): title, status, priority, assignees, due date,
 * labels, description and workspace. Creates (POST /w/{key}/tugas) or
 * edits (PATCH /tugas/{id}); the server answers with a redirect back, so
 * the board reloads its tasks.
 */
export function TaskForm({
    variant,
    options,
    workspaces,
    onWorkspaceChange,
    task,
    defaults,
    today,
    currentUserId,
    canDelete = false,
    onDone,
}: Props) {
    const editing = task !== undefined;
    const touch = variant === 'sheet';
    const size = touch ? 'touch' : 'default';
    const [createAnother, setCreateAnother] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const form = useForm<FormData>(
        initial(options, task, defaults, currentUserId),
    );
    const [workspaceKey, setWorkspaceKey] = useState(options.key);

    // Switched workspace: keep title & description, reset workspace-bound fields.
    if (workspaceKey !== options.key) {
        setWorkspaceKey(options.key);
        const fresh = initial(options, undefined, undefined, currentUserId);
        form.setData((data) => ({
            ...data,
            status_id: fresh.status_id,
            label_ids: [],
            assignee_ids: data.assignee_ids.filter((id) =>
                options.members.some((member) => member.id === id),
            ),
        }));
    }

    const submit = (event: FormEvent) => {
        event.preventDefault();

        const visit = {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                if (!editing && createAnother) {
                    form.setData((data) => ({
                        ...data,
                        title: '',
                        description_text: '',
                    }));

                    return;
                }

                onDone();
            },
        };

        if (editing) {
            form.submit(update(task.id), visit);
        } else {
            form.submit(store(options.key), visit);
        }
    };

    const switchable =
        !editing && workspaces !== undefined && onWorkspaceChange !== undefined;

    return (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <div className="space-y-1">
                <label htmlFor="task-title" className="sr-only">
                    Judul tugas
                </label>
                <input
                    id="task-title"
                    autoFocus
                    value={form.data.title}
                    onChange={(event) =>
                        form.setData('title', event.target.value)
                    }
                    placeholder="Judul tugas"
                    maxLength={255}
                    aria-invalid={form.errors.title ? true : undefined}
                    className={cn(
                        'w-full rounded-lg border border-border bg-surface font-medium text-text placeholder:font-normal placeholder:text-text-subtle focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                        touch
                            ? 'h-14 px-4 text-[17px]'
                            : 'h-11 px-3 text-[15px]',
                    )}
                />
                <InputError message={form.errors.title} />
            </div>

            <div className="flex flex-wrap gap-2">
                <StatusPicker
                    statuses={options.statuses}
                    value={form.data.status_id}
                    onChange={(id) => form.setData('status_id', id)}
                    size={size}
                />
                <PriorityPicker
                    value={form.data.priority}
                    onChange={(priority) => form.setData('priority', priority)}
                    size={size}
                />
                <AssigneePicker
                    people={options.members}
                    value={form.data.assignee_ids}
                    onChange={(ids) => form.setData('assignee_ids', ids)}
                    currentUserId={currentUserId}
                    size={size}
                />
                <DuePicker
                    value={form.data.due_date}
                    onChange={(date) => form.setData('due_date', date)}
                    today={today}
                    size={size}
                />
                <LabelPicker
                    labels={options.labels}
                    value={form.data.label_ids}
                    onChange={(ids) => form.setData('label_ids', ids)}
                    size={size}
                />
            </div>
            <InputError
                message={
                    form.errors.assignee_ids ??
                    form.errors.due_date ??
                    form.errors.status_id
                }
            />

            {touch && (
                <fieldset className="rounded-lg border border-border bg-surface p-3">
                    <legend className="sr-only">Tenggat</legend>
                    <p className="mb-2 text-sm text-text-muted">Tenggat</p>
                    <div className="grid grid-cols-4 gap-2">
                        {quickDueOptions(today).map((option) => (
                            <button
                                key={option.label}
                                type="button"
                                aria-pressed={
                                    form.data.due_date === option.value
                                }
                                onClick={() =>
                                    form.setData('due_date', option.value)
                                }
                                className={cn(
                                    'flex min-h-14 flex-col items-center justify-center rounded-md border text-[15px] leading-5 transition-colors duration-120 ease-brand focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                                    form.data.due_date === option.value
                                        ? 'border-primary bg-primary/10 text-text'
                                        : 'border-border bg-surface-2 text-text',
                                )}
                            >
                                {option.label}
                                <span className="text-xs text-text-muted">
                                    {option.hint}
                                </span>
                            </button>
                        ))}
                        <label className="relative flex min-h-14 cursor-pointer items-center justify-center gap-1 rounded-md border border-dashed border-border-strong text-[15px] text-text-muted focus-within:ring-2 focus-within:ring-ring">
                            Pilih…
                            <input
                                type="date"
                                value={form.data.due_date ?? ''}
                                onChange={(event) =>
                                    form.setData(
                                        'due_date',
                                        event.target.value === ''
                                            ? null
                                            : event.target.value,
                                    )
                                }
                                aria-label="Pilih tanggal tenggat"
                                className="absolute inset-0 cursor-pointer opacity-0"
                            />
                        </label>
                    </div>
                </fieldset>
            )}

            <div className="space-y-1">
                <label htmlFor="task-description" className="text-sm text-text">
                    Deskripsi{' '}
                    <span className="text-text-muted">(opsional)</span>
                </label>
                <textarea
                    id="task-description"
                    value={form.data.description_text}
                    onChange={(event) =>
                        form.setData('description_text', event.target.value)
                    }
                    rows={touch ? 3 : 4}
                    placeholder="Tambahkan detail singkat"
                    className="w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-text placeholder:text-text-subtle focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                />
                <InputError message={form.errors.description_text} />
            </div>

            {switchable ? (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            className={pillClass(
                                size,
                                'w-full justify-between bg-surface',
                            )}
                        >
                            <span className="text-text-muted">Workspace</span>
                            <span className="flex min-w-0 items-center gap-2">
                                <WorkspaceAvatar
                                    name={options.name}
                                    type={options.type}
                                    color={options.color}
                                />
                                <span className="truncate">
                                    {options.type === 'personal'
                                        ? 'Pribadi'
                                        : options.name}
                                </span>
                                <ChevronDown
                                    className="size-4 text-text-muted"
                                    aria-hidden
                                />
                            </span>
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        align="end"
                        className="max-h-80 w-72 overflow-y-auto"
                    >
                        <DropdownMenuRadioGroup
                            value={options.key}
                            onValueChange={onWorkspaceChange}
                        >
                            {(workspaces ?? [options]).map((workspace) => (
                                <DropdownMenuRadioItem
                                    key={workspace.key}
                                    value={workspace.key}
                                >
                                    <WorkspaceAvatar
                                        name={workspace.name}
                                        type={workspace.type}
                                        color={workspace.color}
                                    />
                                    <span className="truncate">
                                        {workspace.type === 'personal'
                                            ? 'Pribadi'
                                            : workspace.name}
                                    </span>
                                </DropdownMenuRadioItem>
                            ))}
                        </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
            ) : null}

            <div
                className={cn(
                    'flex flex-wrap items-center gap-2',
                    touch && 'flex-col items-stretch',
                )}
            >
                {editing &&
                    canDelete &&
                    !touch &&
                    (confirmDelete ? (
                        <span className="flex items-center gap-2 text-sm text-text-muted">
                            Hapus tugas ini?
                            <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() =>
                                    router.visit(destroy(task.id), {
                                        preserveScroll: true,
                                        onSuccess: onDone,
                                    })
                                }
                            >
                                Hapus
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setConfirmDelete(false)}
                            >
                                Batal
                            </Button>
                        </span>
                    ) : (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-danger"
                            onClick={() => setConfirmDelete(true)}
                        >
                            <Trash2 />
                            Hapus
                        </Button>
                    ))}
                {!editing && !touch && (
                    <label className="flex items-center gap-2 text-sm text-text-muted">
                        <input
                            type="checkbox"
                            checked={createAnother}
                            onChange={(event) =>
                                setCreateAnother(event.target.checked)
                            }
                            className="size-4 accent-primary"
                        />
                        Buat lagi
                    </label>
                )}
                <Button
                    type="submit"
                    disabled={form.processing || form.data.title.trim() === ''}
                    className={cn(touch ? 'h-12 w-full text-base' : 'ml-auto')}
                >
                    {editing ? (
                        'Simpan perubahan'
                    ) : (
                        <>
                            <Plus />
                            Buat tugas
                        </>
                    )}
                </Button>
                {touch && !editing && (
                    <p className="flex items-center justify-center gap-1.5 text-sm text-text-muted">
                        <RefreshCw className="size-4" aria-hidden />
                        Tugas langsung muncul di board tim
                    </p>
                )}
                {touch && editing && canDelete && (
                    <Button
                        type="button"
                        variant="ghost"
                        className="h-12 text-danger"
                        onClick={() => {
                            if (confirmDelete) {
                                router.visit(destroy(task.id), {
                                    preserveScroll: true,
                                    onSuccess: onDone,
                                });
                            } else {
                                setConfirmDelete(true);
                            }
                        }}
                    >
                        <Trash2 />
                        {confirmDelete
                            ? 'Ketuk lagi untuk menghapus'
                            : 'Hapus tugas'}
                    </Button>
                )}
            </div>
        </form>
    );
}
