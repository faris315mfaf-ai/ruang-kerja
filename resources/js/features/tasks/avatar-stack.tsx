import { UserAvatar } from '@/components/shell/user-avatar';
import type { Person } from '@/features/tasks/types';
import { cn } from '@/lib/utils';

type Props = {
    people: Person[];
    max?: number;
    /** sm 20 · md 28 · lg 30 (Arus cards and rows). */
    size?: 'sm' | 'md' | 'lg';
    className?: string;
};

/** Overlapping avatars with a "+N" bubble. */
export function AvatarStack({
    people,
    max = 3,
    size = 'sm',
    className,
}: Props) {
    const shown = people.slice(0, max);
    const rest = people.length - shown.length;
    const dimension = {
        sm: 'size-5 text-[9px]',
        md: 'size-7 text-[11px]',
        lg: 'size-[30px] text-[12px]',
    }[size];

    return (
        <span
            className={cn('flex shrink-0 items-center -space-x-1.5', className)}
            title={people.map((person) => person.name).join(', ')}
        >
            {shown.map((person) => (
                <UserAvatar
                    key={person.id}
                    name={person.name}
                    src={person.avatar}
                    className={cn(dimension, 'ring-2 ring-surface')}
                />
            ))}
            {rest > 0 && (
                <span
                    className={cn(
                        'flex items-center justify-center rounded-full bg-surface-2 font-medium text-text-muted ring-2 ring-surface',
                        dimension,
                    )}
                >
                    +{rest}
                </span>
            )}
            <span className="sr-only">
                Penanggung jawab:{' '}
                {people.map((person) => person.name).join(', ')}
            </span>
        </span>
    );
}
