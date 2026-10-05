import { ListFilter, Search, X } from 'lucide-react';
import {
    PRIORITY_LABELS,
    PRIORITY_ORDER,
    PriorityIcon,
} from '@/components/priority-icon';
import { UserAvatar } from '@/components/shell/user-avatar';
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
import { toolbarControl } from '../lib/toolbar';
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
    /** Hide the active-filter chips (rendered elsewhere). */
    withChips?: boolean;
};

function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value)
        ? list.filter((item) => item !== value)
        : [...list, value];
}

const chip =
    'inline-flex h-10 max-w-72 items-center gap-1.5 rounded-control border border-border bg-surface px-3 text-[15px] font-medium text-text';

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
    withChips = true,
}: Props) {
    const active = countActiveFilters(filters);
    const orderedPeople = [...people].sort((a, b) =>
        a.id === currentUserId ? -1 : b.id === currentUserId ? 1 : 0,
    );

    return (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button type="button" className={toolbarControl}>
                        <ListFilter strokeWidth={2} />
                        Filter
                        {active > 0 && (
                            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-link-soft px-1.5 text-[14px] font-bold text-link tnum">
                                {active}
                            </span>
                        )}
                    </button>
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

            {withChips && (
                <ActiveFilterChips
                    filters={filters}
                    onChange={onChange}
                    people={people}
                    labels={labels}
                    currentUserId={currentUserId}
                />
            )}
            {withSearch && (
                <TaskSearchField filters={filters} onChange={onChange} />
            )}
        </div>
    );
}

type ChipProps = Pick<
    Props,
    'filters' | 'onChange' | 'people' | 'labels' | 'currentUserId'
>;

/** Removable chips for the active filters (next to "Filter" or below it). */
export function ActiveFilterChips({
    filters,
    onChange,
    people,
    labels,
    currentUserId,
}: ChipProps) {
    const name = (id: string) =>
        id === NO_ASSIGNEE
            ? 'Belum ditugaskan'
            : id === currentUserId
              ? 'Saya'
              : (people.find((person) => person.id === id)?.name ?? '?');

    return (
        <>
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
        </>
    );
}

/** "Cari tugas…" text search of the task filters. */
export function TaskSearchField({
    filters,
    onChange,
}: Pick<Props, 'filters' | 'onChange'>) {
    return (
        <label className="relative">
            <span className="sr-only">Cari tugas</span>
            <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 size-[18px] -translate-y-1/2 text-text-subtle"
            />
            <input
                type="search"
                value={filters.q}
                onChange={(event) =>
                    onChange({ ...filters, q: event.target.value })
                }
                placeholder="Cari tugas…"
                className="h-10 w-52 rounded-control border border-border bg-surface pr-3 pl-10 text-[15px] text-text placeholder:text-text-subtle focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-ring/55 focus-visible:outline-none"
            />
        </label>
    );
}

function RemoveChip({ onClick }: { onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label="Hapus filter"
            className="-mr-1 flex size-7 items-center justify-center rounded-sm text-text-muted hover:bg-surface-2 hover:text-text focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
        >
            <X className="size-4" />
        </button>
    );
}
