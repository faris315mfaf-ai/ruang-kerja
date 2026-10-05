import { Check } from 'lucide-react';
import {
    PRIORITY_LABELS,
    PRIORITY_ORDER,
    PriorityIcon,
} from '@/components/priority-icon';
import { StatusIcon } from '@/components/status-icon';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { quickDueOptions, nextFriday } from '../form/pickers';
import { addDays, formatShortDate } from '../lib/due-date';
import type { Priority, Task, TaskStatus } from '../types';

export type QuickProperty = 'status' | 'priority' | 'due';

type Props = {
    property: QuickProperty | null;
    task: Task | null;
    statuses: TaskStatus[];
    today: string;
    onOpenChange: (open: boolean) => void;
    onStatus: (statusId: string) => void;
    onPriority: (priority: Priority) => void;
    onDue: (date: string | null) => void;
};

const TITLES: Record<QuickProperty, string> = {
    status: 'Ubah status',
    priority: 'Ubah prioritas',
    due: 'Ubah tenggat',
};

/** Command palette for the S / P / D shortcuts on the focused task. */
export function QuickPropertyDialog({
    property,
    task,
    statuses,
    today,
    onOpenChange,
    onStatus,
    onPriority,
    onDue,
}: Props) {
    const open = property !== null && task !== null;
    const close = () => onOpenChange(false);
    const mark = (active: boolean) =>
        active ? <Check className="ml-auto size-4" aria-hidden /> : null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="glass overflow-hidden p-0 sm:max-w-md">
                <DialogTitle className="sr-only">
                    {property ? TITLES[property] : ''}
                </DialogTitle>
                <DialogDescription className="sr-only">
                    {task ? `${task.key} ${task.title}` : ''}
                </DialogDescription>
                {open && (
                    <Command>
                        <div className="px-3 pt-3 font-mono text-xs text-text-muted">
                            {task.key} · {TITLES[property]}
                        </div>
                        <CommandInput placeholder="Cari…" autoFocus />
                        <CommandList>
                            <CommandEmpty>Tidak ada pilihan.</CommandEmpty>
                            {property === 'status' && (
                                <CommandGroup>
                                    {statuses.map((status) => (
                                        <CommandItem
                                            key={status.id}
                                            value={status.name}
                                            onSelect={() => {
                                                onStatus(status.id);
                                                close();
                                            }}
                                        >
                                            <StatusIcon
                                                category={status.category}
                                                color={status.color}
                                            />
                                            {status.name}
                                            {mark(task.status_id === status.id)}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            )}
                            {property === 'priority' && (
                                <CommandGroup>
                                    {PRIORITY_ORDER.map((priority) => (
                                        <CommandItem
                                            key={priority}
                                            value={PRIORITY_LABELS[priority]}
                                            onSelect={() => {
                                                onPriority(priority);
                                                close();
                                            }}
                                        >
                                            <PriorityIcon
                                                priority={priority}
                                                labelled={false}
                                            />
                                            {PRIORITY_LABELS[priority]}
                                            {mark(task.priority === priority)}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            )}
                            {property === 'due' && (
                                <CommandGroup>
                                    {[
                                        ...quickDueOptions(today),
                                        {
                                            value: addDays(
                                                nextFriday(today),
                                                3,
                                            ),
                                            label: 'Minggu depan',
                                            hint: formatShortDate(
                                                addDays(nextFriday(today), 3),
                                            ),
                                        },
                                    ].map((option) => (
                                        <CommandItem
                                            key={option.label}
                                            value={`${option.label} ${option.hint}`}
                                            onSelect={() => {
                                                onDue(option.value);
                                                close();
                                            }}
                                        >
                                            {option.label === 'Jum'
                                                ? 'Jumat'
                                                : option.label}
                                            <span className="ml-auto text-xs text-text-muted">
                                                {option.hint}
                                            </span>
                                        </CommandItem>
                                    ))}
                                    {task.due_date && (
                                        <CommandItem
                                            value="Hapus tenggat"
                                            onSelect={() => {
                                                onDue(null);
                                                close();
                                            }}
                                        >
                                            Hapus tenggat
                                        </CommandItem>
                                    )}
                                </CommandGroup>
                            )}
                        </CommandList>
                        {property === 'due' && (
                            <label className="flex items-center gap-2 border-t border-border px-3 py-2 text-[13px] text-text-muted">
                                Tanggal lain
                                <input
                                    type="date"
                                    defaultValue={task.due_date ?? ''}
                                    onChange={(event) => {
                                        if (event.target.value) {
                                            onDue(event.target.value);
                                            close();
                                        }
                                    }}
                                    className="h-8 flex-1 rounded-md border border-border bg-surface px-2 text-text"
                                />
                            </label>
                        )}
                    </Command>
                )}
            </DialogContent>
        </Dialog>
    );
}
