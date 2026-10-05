import type { ReactNode } from 'react';
import {
    PRIORITY_LABELS,
    PRIORITY_ORDER,
    PriorityIcon,
} from '@/components/priority-icon';
import { BottomSheet } from '@/components/mobile/bottom-sheet';
import { Button } from '@/components/ui/button';
import { palette } from '@/lib/palette';
import { cn } from '@/lib/utils';
import type { DueFilter, TaskFilters } from '../lib/filters';
import { DUE_FILTER_LABELS, EMPTY_FILTERS, NO_ASSIGNEE } from '../lib/filters';
import type { Label, Person, Priority } from '../types';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    filters: TaskFilters;
    onChange: (filters: TaskFilters) => void;
    people: Person[];
    labels: Label[];
    currentUserId?: string;
};

function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value)
        ? list.filter((item) => item !== value)
        : [...list, value];
}

function Toggle({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            aria-pressed={active}
            onClick={onClick}
            className={cn(
                'flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-sm transition-colors duration-120 ease-brand focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                active
                    ? 'border-primary bg-primary/12 text-text'
                    : 'border-border bg-surface text-text-muted',
            )}
        >
            {children}
        </button>
    );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="space-y-2">
            <h3 className="text-[13px] font-medium text-text-muted">{title}</h3>
            <div className="flex flex-wrap gap-2">{children}</div>
        </section>
    );
}

/** Mobile filters (bottom sheet): same filters as the desktop menu. */
export function FilterSheet({
    open,
    onOpenChange,
    filters,
    onChange,
    people,
    labels,
    currentUserId,
}: Props) {
    return (
        <BottomSheet
            open={open}
            onOpenChange={onOpenChange}
            title="Filter tugas"
            footer={
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        className="h-12 flex-1"
                        onClick={() => onChange(EMPTY_FILTERS)}
                    >
                        Hapus filter
                    </Button>
                    <Button
                        className="h-12 flex-1"
                        onClick={() => onOpenChange(false)}
                    >
                        Selesai
                    </Button>
                </div>
            }
        >
            <div className="space-y-5 pb-2">
                <label className="block space-y-2">
                    <span className="text-[13px] font-medium text-text-muted">
                        Cari
                    </span>
                    <input
                        type="search"
                        value={filters.q}
                        onChange={(event) =>
                            onChange({ ...filters, q: event.target.value })
                        }
                        placeholder="Judul, ID, atau deskripsi"
                        className="h-12 w-full rounded-md border border-border bg-surface px-3 text-text placeholder:text-text-subtle focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    />
                </label>

                <Section title="Penanggung jawab">
                    {currentUserId && (
                        <Toggle
                            active={filters.assignees.includes(currentUserId)}
                            onClick={() =>
                                onChange({
                                    ...filters,
                                    assignees: toggle(
                                        filters.assignees,
                                        currentUserId,
                                    ),
                                })
                            }
                        >
                            Saya
                        </Toggle>
                    )}
                    <Toggle
                        active={filters.assignees.includes(NO_ASSIGNEE)}
                        onClick={() =>
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
                    </Toggle>
                    {people
                        .filter((person) => person.id !== currentUserId)
                        .map((person) => (
                            <Toggle
                                key={person.id}
                                active={filters.assignees.includes(person.id)}
                                onClick={() =>
                                    onChange({
                                        ...filters,
                                        assignees: toggle(
                                            filters.assignees,
                                            person.id,
                                        ),
                                    })
                                }
                            >
                                {person.name}
                            </Toggle>
                        ))}
                </Section>

                <Section title="Prioritas">
                    {PRIORITY_ORDER.map((priority) => (
                        <Toggle
                            key={priority}
                            active={filters.priorities.includes(priority)}
                            onClick={() =>
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
                        </Toggle>
                    ))}
                </Section>

                {labels.length > 0 && (
                    <Section title="Label">
                        {labels.map((label) => (
                            <Toggle
                                key={label.id}
                                active={filters.labels.includes(label.id)}
                                onClick={() =>
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
                            </Toggle>
                        ))}
                    </Section>
                )}

                <Section title="Tenggat">
                    {(Object.keys(DUE_FILTER_LABELS) as DueFilter[]).map(
                        (due) => (
                            <Toggle
                                key={due}
                                active={filters.due === due}
                                onClick={() =>
                                    onChange({
                                        ...filters,
                                        due: filters.due === due ? null : due,
                                    })
                                }
                            >
                                {DUE_FILTER_LABELS[due]}
                            </Toggle>
                        ),
                    )}
                </Section>
            </div>
        </BottomSheet>
    );
}
