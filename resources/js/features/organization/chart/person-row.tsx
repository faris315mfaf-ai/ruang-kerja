import type { ReactNode } from 'react';
import { UserAvatar } from '@/components/shell/user-avatar';
import { cn } from '@/lib/utils';
import type { OrgPerson } from './types';

type Props = {
    person: OrgPerson;
    /** Defaults to the person's position. */
    subtitle?: string | null;
    isYou?: boolean;
    trailing?: ReactNode;
    size?: 'sm' | 'md';
    className?: string;
};

/** Avatar + name (+ "(Anda)") + position, used on chart cards and lists. */
export function PersonRow({
    person,
    subtitle,
    isYou = false,
    trailing,
    size = 'md',
    className,
}: Props) {
    const line = subtitle === undefined ? person.position : subtitle;

    return (
        <div className={cn('flex min-w-0 items-center gap-2.5', className)}>
            <UserAvatar
                name={person.name}
                src={person.avatar}
                className={cn(
                    'shrink-0',
                    size === 'sm' ? 'size-6 text-[10px]' : 'size-8',
                )}
            />
            <span className="grid min-w-0 flex-1 leading-tight">
                <span
                    className={cn(
                        'truncate text-text',
                        size === 'sm' ? 'text-[13px]' : 'text-sm',
                    )}
                >
                    {person.name}
                    {isYou && <span className="text-text-muted"> (Anda)</span>}
                </span>
                {line && (
                    <span className="truncate text-xs text-text-muted">
                        {line}
                    </span>
                )}
            </span>
            {trailing}
        </div>
    );
}

/** Overlapping avatars with a "+N" chip. */
export function AvatarStack({
    people,
    total,
    max = 3,
}: {
    people: OrgPerson[];
    total?: number;
    max?: number;
}) {
    const shown = people.slice(0, max);
    const rest = (total ?? people.length) - shown.length;

    return (
        <span className="flex items-center -space-x-1.5" aria-hidden>
            {shown.map((person) => (
                <UserAvatar
                    key={person.id}
                    name={person.name}
                    src={person.avatar}
                    className="size-6 text-[10px] ring-2 ring-surface"
                />
            ))}
            {rest > 0 && (
                <span className="flex size-6 items-center justify-center rounded-full bg-surface-2 text-[10px] font-semibold text-text-muted ring-2 ring-surface">
                    +{rest}
                </span>
            )}
        </span>
    );
}

export function TeamBadge() {
    return (
        <span className="rounded-full bg-link-soft px-2 py-0.5 text-[11px] font-medium text-primary">
            Ketua
        </span>
    );
}

export function CodeBadge({ code }: { code: string }) {
    return (
        <span className="rounded border border-border px-1.5 py-px font-mono text-[11px] text-text-muted">
            {code}
        </span>
    );
}
