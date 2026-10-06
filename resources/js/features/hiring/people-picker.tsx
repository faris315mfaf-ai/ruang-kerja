import { Search } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { Person } from './types';

/**
 * Multi-select of employees (interviewers, final approvers): selected people
 * as removable chips + a searchable checkbox list.
 */
export function PeoplePicker({
    label,
    description,
    people,
    value,
    onChange,
    max,
    error,
}: {
    label: string;
    description?: string;
    people: Person[];
    value: string[];
    onChange: (ids: string[]) => void;
    max?: number;
    error?: string;
}) {
    const id = useId();
    const [query, setQuery] = useState('');
    const selected = value
        .map((personId) => people.find((person) => person.id === personId))
        .filter((person): person is Person => person !== undefined);
    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();

        return needle === ''
            ? people
            : people.filter((person) =>
                  `${person.name} ${person.position ?? ''}`
                      .toLowerCase()
                      .includes(needle),
              );
    }, [people, query]);
    const full = max !== undefined && value.length >= max;

    const toggle = (personId: string, on: boolean) => {
        onChange(
            on
                ? [...value, personId]
                : value.filter((existing) => existing !== personId),
        );
    };

    return (
        <fieldset className="flex min-w-0 flex-col gap-2.5">
            <legend className="text-label text-text">{label}</legend>
            {description && (
                <p className="-mt-1 text-meta text-text-muted">{description}</p>
            )}
            {selected.length > 0 ? (
                <ul
                    className="flex flex-wrap gap-2"
                    aria-label={`${label} terpilih`}
                >
                    {selected.map((person) => (
                        <li key={person.id}>
                            <button
                                type="button"
                                onClick={() => toggle(person.id, false)}
                                className="flex h-9 items-center gap-2 rounded-full border border-border bg-surface-2 pr-3 pl-1 text-[15px] font-semibold text-text transition-colors duration-120 ease-brand hover:border-border-strong focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
                                aria-label={`Hapus ${person.name}`}
                            >
                                <UserAvatar
                                    name={person.name}
                                    src={person.avatar}
                                    className="size-7"
                                />
                                {person.name}
                                <span aria-hidden className="text-text-subtle">
                                    ×
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-meta text-text-muted">
                    Belum ada yang dipilih.
                </p>
            )}
            <div className="relative">
                <Search
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-text-subtle"
                />
                <Input
                    id={id}
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Cari nama karyawan"
                    aria-label={`Cari ${label.toLowerCase()}`}
                    className="pl-10"
                />
            </div>
            <ul className="max-h-60 divide-y divide-divider overflow-y-auto rounded-control border border-border bg-surface">
                {filtered.length === 0 && (
                    <li className="px-4 py-3 text-meta text-text-muted">
                        Tidak ada karyawan yang cocok.
                    </li>
                )}
                {filtered.map((person) => {
                    const checked = value.includes(person.id);
                    const disabled = !checked && full;

                    return (
                        <li key={person.id}>
                            <label
                                className={cn(
                                    'flex min-h-12 cursor-pointer items-center gap-3 px-4 py-2',
                                    disabled && 'cursor-not-allowed opacity-60',
                                )}
                            >
                                <Checkbox
                                    checked={checked}
                                    disabled={disabled}
                                    onCheckedChange={(state) =>
                                        toggle(person.id, state === true)
                                    }
                                />
                                <UserAvatar
                                    name={person.name}
                                    src={person.avatar}
                                    className="size-8"
                                />
                                <span className="flex min-w-0 flex-col">
                                    <span className="truncate text-[15px] font-semibold text-text">
                                        {person.name}
                                    </span>
                                    {person.position && (
                                        <span className="truncate text-meta text-text-muted">
                                            {person.position}
                                        </span>
                                    )}
                                </span>
                            </label>
                        </li>
                    );
                })}
            </ul>
            {error && <p className="text-meta text-danger">{error}</p>}
        </fieldset>
    );
}
