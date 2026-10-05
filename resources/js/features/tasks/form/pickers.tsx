import { CalendarDays, Check, ChevronDown, Tag, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { useRef } from 'react';
import {
    PRIORITY_LABELS,
    PRIORITY_ORDER,
    PriorityIcon,
} from '@/components/priority-icon';
import { UserAvatar } from '@/components/shell/user-avatar';
import { StatusIcon } from '@/components/status-icon';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { palette } from '@/lib/palette';
import { cn } from '@/lib/utils';
import {
    addDays,
    formatDue,
    formatShortDate,
    isoWeekday,
} from '../lib/due-date';
import type { Label, Person, Priority, TaskStatus } from '../types';

type Size = 'default' | 'touch';

export function pillClass(size: Size, extra?: string): string {
    return cn(
        'inline-flex max-w-full items-center gap-2 rounded-control border border-border bg-surface font-semibold text-text transition-colors duration-120 ease-brand hover:bg-surface-2 focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60 [&_svg]:shrink-0',
        size === 'touch' ? 'h-11 px-3.5 text-[16px]' : 'h-9 px-3 text-[15px]',
        extra,
    );
}

function Pill({
    size,
    label,
    children,
    dashed,
    tone,
    disabled,
}: {
    size: Size;
    label: string;
    children: ReactNode;
    dashed?: boolean;
    tone?: 'primary';
    disabled?: boolean;
}) {
    return (
        <DropdownMenuTrigger asChild disabled={disabled}>
            <button
                type="button"
                aria-label={label}
                className={pillClass(
                    size,
                    cn(
                        dashed && 'border-dashed text-text-muted',
                        tone === 'primary' &&
                            'border-primary/50 bg-link-soft text-link',
                    ),
                )}
            >
                {children}
            </button>
        </DropdownMenuTrigger>
    );
}

export function StatusPicker({
    statuses,
    value,
    onChange,
    size = 'default',
}: {
    statuses: TaskStatus[];
    value: string | null;
    onChange: (id: string) => void;
    size?: Size;
}) {
    const current =
        statuses.find((status) => status.id === value) ?? statuses[0];

    return (
        <DropdownMenu>
            <Pill
                size={size}
                label={`Status: ${current?.name ?? '-'}`}
                disabled={statuses.length === 0}
            >
                {current && (
                    <StatusIcon
                        category={current.category}
                        color={current.color}
                    />
                )}
                <span className="truncate">{current?.name ?? 'Status'}</span>
            </Pill>
            <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuRadioGroup
                    value={current?.id ?? ''}
                    onValueChange={onChange}
                >
                    {statuses.map((status) => (
                        <DropdownMenuRadioItem
                            key={status.id}
                            value={status.id}
                        >
                            <StatusIcon
                                category={status.category}
                                color={status.color}
                            />
                            {status.name}
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export function PriorityPicker({
    value,
    onChange,
    size = 'default',
}: {
    value: Priority;
    onChange: (priority: Priority) => void;
    size?: Size;
}) {
    return (
        <DropdownMenu>
            <Pill size={size} label={`Prioritas: ${PRIORITY_LABELS[value]}`}>
                <PriorityIcon priority={value} labelled={false} />
                {value === 0 ? 'Prioritas' : PRIORITY_LABELS[value]}
            </Pill>
            <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuRadioGroup
                    value={String(value)}
                    onValueChange={(next) => onChange(Number(next) as Priority)}
                >
                    {PRIORITY_ORDER.map((priority) => (
                        <DropdownMenuRadioItem
                            key={priority}
                            value={String(priority)}
                        >
                            <PriorityIcon
                                priority={priority}
                                labelled={false}
                            />
                            {PRIORITY_LABELS[priority]}
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export function AssigneePicker({
    people,
    value,
    onChange,
    currentUserId,
    size = 'default',
}: {
    people: Person[];
    value: string[];
    onChange: (ids: string[]) => void;
    currentUserId?: string;
    size?: Size;
}) {
    const selected = people.filter((person) => value.includes(person.id));
    const ordered = [...people].sort((a, b) =>
        a.id === currentUserId
            ? -1
            : b.id === currentUserId
              ? 1
              : a.name.localeCompare(b.name, 'id'),
    );
    const summary =
        selected.length === 0
            ? 'Penanggung jawab'
            : selected.length === 1
              ? selected[0].id === currentUserId
                  ? 'Saya'
                  : selected[0].name
              : `${selected.length} orang`;

    return (
        <DropdownMenu>
            <Pill
                size={size}
                label={`Penanggung jawab: ${summary}`}
                dashed={selected.length === 0}
            >
                {selected.length === 1 ? (
                    <UserAvatar
                        name={selected[0].name}
                        src={selected[0].avatar}
                        className="size-5 text-[9px]"
                    />
                ) : (
                    <UserRound
                        className="size-4"
                        strokeWidth={1.75}
                        aria-hidden
                    />
                )}
                <span className="truncate">{summary}</span>
            </Pill>
            <DropdownMenuContent
                align="start"
                className="max-h-80 w-64 overflow-y-auto"
            >
                {ordered.map((person) => (
                    <DropdownMenuCheckboxItem
                        key={person.id}
                        checked={value.includes(person.id)}
                        onSelect={(event) => event.preventDefault()}
                        onCheckedChange={(checked) =>
                            onChange(
                                checked
                                    ? [...value, person.id]
                                    : value.filter((id) => id !== person.id),
                            )
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
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export function LabelPicker({
    labels,
    value,
    onChange,
    size = 'default',
}: {
    labels: Label[];
    value: string[];
    onChange: (ids: string[]) => void;
    size?: Size;
}) {
    const selected = labels.filter((label) => value.includes(label.id));

    return (
        <DropdownMenu>
            <Pill
                size={size}
                label={
                    selected.length === 0
                        ? 'Label'
                        : `Label: ${selected.map((label) => label.name).join(', ')}`
                }
                dashed={selected.length === 0}
                disabled={labels.length === 0}
            >
                {selected.length === 0 ? (
                    <>
                        <Tag
                            className="size-4"
                            strokeWidth={1.75}
                            aria-hidden
                        />
                        Label
                    </>
                ) : (
                    selected.slice(0, 3).map((label) => (
                        <span
                            key={label.id}
                            className="flex items-center gap-1.5"
                        >
                            <span
                                aria-hidden
                                className={cn(
                                    'size-2 rounded-full',
                                    palette(label.color).bg,
                                )}
                            />
                            {label.name}
                        </span>
                    ))
                )}
            </Pill>
            <DropdownMenuContent
                align="start"
                className="max-h-80 w-56 overflow-y-auto"
            >
                {labels.map((label) => (
                    <DropdownMenuCheckboxItem
                        key={label.id}
                        checked={value.includes(label.id)}
                        onSelect={(event) => event.preventDefault()}
                        onCheckedChange={(checked) =>
                            onChange(
                                checked
                                    ? [...value, label.id]
                                    : value.filter((id) => id !== label.id),
                            )
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
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/** Upcoming Friday (today when it is Friday), as in the MTugasBaru chips. */
export function nextFriday(today: string): string {
    const weekday = isoWeekday(today);

    return addDays(today, weekday <= 5 ? 5 - weekday : 12 - weekday);
}

export function quickDueOptions(
    today: string,
): { value: string; label: string; hint: string }[] {
    const friday = nextFriday(today);

    return [
        {
            value: today,
            label: 'Hari ini',
            hint: formatShortDate(today).replace(',', ''),
        },
        {
            value: addDays(today, 1),
            label: 'Besok',
            hint: formatShortDate(addDays(today, 1)).replace(',', ''),
        },
        {
            value: friday,
            label: 'Jum',
            hint: formatShortDate(friday).split(', ')[1] ?? '',
        },
    ];
}

export function DuePicker({
    value,
    onChange,
    today,
    size = 'default',
}: {
    value: string | null;
    onChange: (date: string | null) => void;
    today: string;
    size?: Size;
}) {
    const input = useRef<HTMLInputElement>(null);

    return (
        <DropdownMenu>
            <Pill
                size={size}
                label={
                    value
                        ? `Tenggat: ${formatDue(value, today)}`
                        : 'Pilih tenggat'
                }
                tone={value ? 'primary' : undefined}
            >
                <CalendarDays
                    className="size-4"
                    strokeWidth={1.75}
                    aria-hidden
                />
                {value ? formatDue(value, today) : 'Pilih tanggal'}
                <ChevronDown className="size-3.5 opacity-60" aria-hidden />
            </Pill>
            <DropdownMenuContent align="start" className="w-60">
                {quickDueOptions(today).map((option) => (
                    <DropdownMenuItem
                        key={option.label}
                        onSelect={() => onChange(option.value)}
                    >
                        {value === option.value ? (
                            <Check />
                        ) : (
                            <span className="size-4" />
                        )}
                        {option.label}
                        <span className="ml-auto text-meta text-text-muted">
                            {option.hint}
                        </span>
                    </DropdownMenuItem>
                ))}
                <DropdownMenuItem
                    onSelect={() => onChange(addDays(nextFriday(today), 3))}
                >
                    {value === addDays(nextFriday(today), 3) ? (
                        <Check />
                    ) : (
                        <span className="size-4" />
                    )}
                    Minggu depan
                    <span className="ml-auto text-meta text-text-muted">
                        {formatShortDate(addDays(nextFriday(today), 3)).replace(
                            ',',
                            '',
                        )}
                    </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <div
                    className="px-2 py-1.5"
                    onKeyDown={(event) => event.stopPropagation()}
                >
                    <label className="space-y-1 text-meta text-text-muted">
                        <span>Tanggal lain</span>
                        <input
                            ref={input}
                            type="date"
                            value={value ?? ''}
                            onChange={(event) =>
                                onChange(
                                    event.target.value === ''
                                        ? null
                                        : event.target.value,
                                )
                            }
                            className="h-8 w-full rounded-control border border-border bg-surface px-2 text-[15px] text-text focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
                        />
                    </label>
                </div>
                {value && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => onChange(null)}>
                            Hapus tenggat
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
