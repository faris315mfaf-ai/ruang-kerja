import { Mail, Search, X } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { useId, useMemo, useState } from 'react';
import { UserAvatar } from '@/components/shell/user-avatar';
import { cn } from '@/lib/utils';
import { ME } from './fixtures';
import { isEmail } from './lib';
import type { Person } from './types';

/** Case-insensitive match on name, title or division. */
export function searchPeople(
    people: Person[],
    query: string,
    exclude: string[],
): Person[] {
    const needle = query.trim().toLowerCase();

    if (!needle) {
        return [];
    }

    return people
        .filter((person) => !exclude.includes(person.id))
        .filter((person) =>
            [person.name, person.title, person.division].some((field) =>
                field.toLowerCase().includes(needle),
            ),
        )
        .slice(0, 6);
}

/**
 * Participant chips + search combobox (DRapatBaru "Peserta"): type a name,
 * pick with ↑/↓ + Enter, or type an email and press Enter for a guest.
 */
export function PeoplePicker({
    people,
    value,
    onAdd,
    onRemove,
    invalid,
    describedBy,
    labelId,
}: {
    people: Person[];
    value: string[];
    onAdd: (idOrEmail: string) => void;
    onRemove: (idOrEmail: string) => void;
    invalid?: boolean;
    describedBy?: string;
    labelId: string;
}) {
    const listId = useId();
    const [query, setQuery] = useState('');
    const [active, setActive] = useState(0);
    const matches = useMemo(
        () => searchPeople(people, query, value),
        [people, query, value],
    );
    const emailOption =
        isEmail(query) && !value.includes(query.trim().toLowerCase());
    const optionCount = matches.length + (emailOption ? 1 : 0);
    const open = query.trim() !== '' && optionCount > 0;

    const choose = (index: number) => {
        if (index < matches.length) {
            onAdd(matches[index].id);
        } else if (emailOption) {
            onAdd(query);
        }

        setQuery('');
        setActive(0);
    };

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'ArrowDown' && open) {
            event.preventDefault();
            setActive((current) => (current + 1) % optionCount);
        } else if (event.key === 'ArrowUp' && open) {
            event.preventDefault();
            setActive((current) => (current - 1 + optionCount) % optionCount);
        } else if (event.key === 'Enter') {
            event.preventDefault();

            if (open) {
                choose(Math.min(active, optionCount - 1));
            }
        } else if (event.key === 'Escape') {
            setQuery('');
        } else if (
            event.key === 'Backspace' &&
            query === '' &&
            value.length > 1
        ) {
            onRemove(value[value.length - 1]);
        }
    };

    return (
        <div className="relative">
            <div
                className={cn(
                    'flex flex-wrap gap-2 rounded-[14px] border border-border-strong bg-surface p-2.5 transition-[border-color,box-shadow] duration-120 ease-brand focus-within:border-primary focus-within:ring-4 focus-within:ring-ring/55',
                    invalid && 'border-danger',
                )}
            >
                {value.map((item) => {
                    const person = people.find((p) => p.id === item);
                    const name = person
                        ? person.id === ME
                            ? `${person.name.split(' ')[0]} (Anda)`
                            : person.name
                        : item;

                    return (
                        <span
                            key={item}
                            className={cn(
                                'inline-flex h-[38px] max-w-full items-center gap-2 rounded-full pr-1 pl-[5px] text-[15px] font-semibold',
                                person
                                    ? 'bg-link-soft text-brand-800 dark:text-link'
                                    : 'bg-surface-2 pr-1 text-text-muted',
                            )}
                        >
                            {person ? (
                                <UserAvatar
                                    name={person.name}
                                    className="size-7 text-[11px]"
                                />
                            ) : (
                                <span
                                    aria-hidden
                                    className="flex size-7 items-center justify-center rounded-full bg-surface"
                                >
                                    <Mail className="size-4" />
                                </span>
                            )}
                            <span className="truncate">{name}</span>
                            {item !== ME ? (
                                <button
                                    type="button"
                                    onClick={() => onRemove(item)}
                                    aria-label={`Hapus ${person?.name ?? item}`}
                                    className="relative flex size-8 items-center justify-center rounded-full outline-none after:absolute after:-inset-1.5 after:content-[''] hover:bg-surface focus-visible:ring-[3px] focus-visible:ring-ring"
                                >
                                    <X aria-hidden className="size-4" />
                                </button>
                            ) : (
                                <span className="w-2" />
                            )}
                        </span>
                    );
                })}
                <span className="flex min-w-[200px] flex-1 items-center gap-2 px-1">
                    <Search
                        aria-hidden
                        className="size-[18px] shrink-0 text-text-subtle"
                    />
                    <input
                        type="text"
                        role="combobox"
                        aria-labelledby={labelId}
                        aria-expanded={open}
                        aria-controls={listId}
                        aria-autocomplete="list"
                        aria-activedescendant={
                            open ? `${listId}-${active}` : undefined
                        }
                        aria-invalid={invalid || undefined}
                        aria-describedby={describedBy}
                        value={query}
                        onChange={(event) => {
                            setQuery(event.target.value);
                            setActive(0);
                        }}
                        onKeyDown={onKeyDown}
                        placeholder="Tambah nama atau email…"
                        className="h-[38px] min-w-0 flex-1 bg-transparent text-[16px] text-text outline-none placeholder:text-text-subtle"
                    />
                </span>
            </div>
            {open && (
                <ul
                    id={listId}
                    role="listbox"
                    aria-label="Saran peserta"
                    className="glass-strong absolute inset-x-0 top-[calc(100%+6px)] z-20 flex max-h-80 flex-col overflow-y-auto rounded-lg p-1.5 shadow-float"
                >
                    {matches.map((person, index) => (
                        <li
                            key={person.id}
                            id={`${listId}-${index}`}
                            role="option"
                            aria-selected={index === active}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => choose(index)}
                            className={cn(
                                'flex min-h-12 cursor-pointer items-center gap-3 rounded-control px-3 py-1.5',
                                index === active
                                    ? 'bg-surface-2'
                                    : 'hover:bg-surface-2/60',
                            )}
                        >
                            <UserAvatar name={person.name} className="size-8" />
                            <span className="flex min-w-0 flex-col">
                                <span className="truncate text-[16px] font-semibold">
                                    {person.name}
                                </span>
                                <span className="truncate text-[14px] text-text-muted">
                                    {person.title} · {person.division}
                                </span>
                            </span>
                        </li>
                    ))}
                    {emailOption && (
                        <li
                            id={`${listId}-${matches.length}`}
                            role="option"
                            aria-selected={active === matches.length}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => choose(matches.length)}
                            className={cn(
                                'flex min-h-12 cursor-pointer items-center gap-3 rounded-control px-3',
                                active === matches.length
                                    ? 'bg-surface-2'
                                    : 'hover:bg-surface-2/60',
                            )}
                        >
                            <Mail
                                aria-hidden
                                className="size-5 text-text-muted"
                            />
                            <span className="text-[16px]">
                                Undang tamu <b>{query.trim()}</b>
                            </span>
                        </li>
                    )}
                </ul>
            )}
        </div>
    );
}
