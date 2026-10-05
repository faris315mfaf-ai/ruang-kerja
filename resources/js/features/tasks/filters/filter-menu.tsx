import { ListFilter, Search, X } from 'lucide-react';
import {
    PRIORITY_LABELS,
    PRIORITY_ORDER,
    PriorityIcon,
} from '@/components/priority-icon';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { palette } from '@/lib/palette';
import { cn } from '@/lib/utils';
import type { DueFilter, TaskFilters } from '../lib/filters';
import {
    countActiveFilters,
    DUE_FILTER_LABELS,
    EMPTY_FILTERS,
    NO_ASSIGNEE,
} from '../lib/filters';
import type { Label, Person, Priority } from '../types';

type Props = {
    filters: TaskFilters;
    onChange: (filters: TaskFilters) => void;
    people: Person[];
    labels: Label[];
    currentUserId?: string;
    /** Hide the text search (when the page has its own). */
    withSearch?: boolean;
};

function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value)
        ? list.filter((item) => item !== value)
        : [...list, value];
}

const chip =
    'inline-flex h-8 max-w-72 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-[13px] text-text';

/**
 * Desktop filter toolbar (mockup Kanban): dashed "Filter" button with
 * sub-menus (penanggung jawab, prioritas, label, tenggat), text search and
 * removable chips for the active filters.
 */
export function FilterMenu({
    filters,
    onChange,
    people,
    labels,
    currentUserId,
    withSearch = true,
}: Props) {
    const active = countActiveFilters(filters);
    const name = (id: string) =>
        id === NO_ASSIGNEE
            ? 'Belum ditugaskan'
            : id === currentUserId
              ? 'Saya'
              : (people.find((person) => person.id === id)?.name ?? '?');
    const orderedPeople = [...people].sort((a, b) =>
        a.id === currentUserId ? -1 : b.id === currentUserId ? 1 : 0,
    );

    return (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 border-dashed bg-transparent text-text"
                    >
                        <ListFilter />
                        Filter
                        {active > 0 && (
                            <span className="rounded-full bg-primary/15 px-1.5 text-[11px] text-primary tnum">
                                {active}
                            </span>
                        )}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            Penanggung jawab
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="max-h-80 w-60 overflow-y-auto">
                            <DropdownMenuCheckboxItem
                                checked={filters.assignees.includes(
                                    NO_ASSIGNEE,
                                )}
                                onSelect={(event) => event.preventDefault()}
                                onCheckedChange={() =>
                                    onChange({
                                        ...filters,
                                        assignees: toggle(
                                            filters.assignees,
                                            NO_ASSIGNEE,
                                        ),
                                    })
                                }
                            >
                                Belum ditugaskan
                            </DropdownMenuCheckboxItem>
                            {orderedPeople.map((person) => (
                                <DropdownMenuCheckboxItem
                                    key={person.id}
                                    checked={filters.assignees.includes(
                                        person.id,
                                    )}
                                    onSelect={(event) => event.preventDefault()}
                                    onCheckedChange={() =>
                                        onChange({
                                            ...filters,
                                            assignees: toggle(
                                                filters.assignees,
                                                person.id,
                                            ),
                                        })
                                    }
                                >
                                    <UserAvatar
                                        name={person.name}
                                        src={person.avatar}
                                        className="size-5 text-[9px]"
                                    />
                                    <span className="truncate">
                                        {person.id === currentUserId
                                            ? `${person.name} (Saya)`
                                            : person.name}
                                    </span>
                                </DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            Prioritas
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-48">
                            {PRIORITY_ORDER.map((priority) => (
                                <DropdownMenuCheckboxItem
                                    key={priority}
                                    checked={filters.priorities.includes(
                                        priority,
                                    )}
                                    onSelect={(event) => event.preventDefault()}
                                    onCheckedChange={() =>
                                        onChange({
                                            ...filters,
                                            priorities: toggle<Priority>(
                                                filters.priorities,
                                                priority,
                                            ),
                                        })
                                    }
                                >
                                    <PriorityIcon
                                        priority={priority}
                                        labelled={false}
                                    />
                                    {PRIORITY_LABELS[priority]}
                                </DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger disabled={labels.length === 0}>
                            Label
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="max-h-80 w-52 overflow-y-auto">
                            {labels.map((label) => (
                                <DropdownMenuCheckboxItem
                                    key={label.id}
                                    checked={filters.labels.includes(label.id)}
                                    onSelect={(event) => event.preventDefault()}
                                    onCheckedChange={() =>
                                        onChange({
                                            ...filters,
                                            labels: toggle(
                                                filters.labels,
                                                label.id,
                                            ),
                                        })
                                    }
                                >
                                    <span
                                        aria-hidden
                                        className={cn(
                                            'size-2 rounded-full',
                                            palette(label.color).bg,
                                        )}
                                    />
                                    {label.name}
                                </DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>Tenggat</DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-48">
                            <DropdownMenuRadioGroup
                                value={filters.due ?? ''}
                                onValueChange={(value) =>
                                    onChange({
                                        ...filters,
                                        due:
                                            value === ''
                                                ? null
                                                : (value as DueFilter),
                                    })
                                }
                            >
                                <DropdownMenuRadioItem value="">
                                    Semua
                                </DropdownMenuRadioItem>
                                {(
                                    Object.keys(
                                        DUE_FILTER_LABELS,
                                    ) as DueFilter[]
                                ).map((due) => (
                                    <DropdownMenuRadioItem
                                        key={due}
                                        value={due}
                                    >
                                        {DUE_FILTER_LABELS[due]}
                                    </DropdownMenuRadioItem>
                                ))}
                            </DropdownMenuRadioGroup>
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    {active > 0 && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onSelect={() => onChange(EMPTY_FILTERS)}
                            >
                                <X />
                                Hapus semua filter
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            {filters.assignees.length > 0 && (
                <span className={chip}>
                    <span className="truncate">
                        Penanggung jawab:{' '}
                        {filters.assignees.map(name).join(', ')}
                    </span>
                    <RemoveChip
                        onClick={() => onChange({ ...filters, assignees: [] })}
                    />
                </span>
            )}
            {filters.priorities.length > 0 && (
                <span className={chip}>
                    <span className="truncate">
                        Prioritas:{' '}
                        {filters.priorities
                            .map((priority) => PRIORITY_LABELS[priority])
                            .join(', ')}
                    </span>
                    <RemoveChip
                        onClick={() => onChange({ ...filters, priorities: [] })}
                    />
                </span>
            )}
            {filters.labels.length > 0 && (
                <span className={chip}>
                    <span className="truncate">
                        Label:{' '}
                        {filters.labels
                            .map(
                                (id) =>
                                    labels.find((label) => label.id === id)
                                        ?.name ?? '?',
                            )
                            .join(', ')}
                    </span>
                    <RemoveChip
                        onClick={() => onChange({ ...filters, labels: [] })}
                    />
                </span>
            )}
            {filters.due && (
                <span className={chip}>
                    Tenggat: {DUE_FILTER_LABELS[filters.due]}
                    <RemoveChip
                        onClick={() => onChange({ ...filters, due: null })}
                    />
                </span>
            )}

            {withSearch && (
                <label className="relative">
                    <span className="sr-only">Cari tugas</span>
                    <Search
                        aria-hidden
                        className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-text-subtle"
                    />
                    <input
                        type="search"
                        value={filters.q}
                        onChange={(event) =>
                            onChange({ ...filters, q: event.target.value })
                        }
                        placeholder="Cari tugas…"
                        className="h-8 w-44 rounded-md border border-border bg-surface pr-2 pl-8 text-[13px] text-text placeholder:text-text-subtle focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    />
                </label>
            )}
        </div>
    );
}

function RemoveChip({ onClick }: { onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label="Hapus filter"
            className="-mr-1 rounded p-0.5 text-text-subtle hover:text-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
            <X className="size-3.5" />
        </button>
    );
}
