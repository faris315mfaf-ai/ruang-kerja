import { Pencil } from 'lucide-react';
import { UserAvatar } from '@/components/shell/user-avatar';
import { cn } from '@/lib/utils';
import type { TaskPresence } from './board-presence';
import { typingLabel, viewersLabel } from './board-presence';

/**
 * Who else has this task open (board card, list row): at most two 20px
 * avatars plus "+N", with the green "online" dot of the task sheet's
 * PresenceBadge. Decorative for screen readers: the card's own aria-label
 * carries the same text (presenceDescription).
 */
export function ViewerAvatars({
    presence,
    on = 'card',
    className,
}: {
    presence: TaskPresence | undefined;
    /** Background behind the avatars (separating ring): board card or list panel. */
    on?: 'card' | 'surface';
    className?: string;
}) {
    const viewers = presence?.viewers ?? [];

    if (viewers.length === 0) {
        return null;
    }

    const shown = viewers.slice(0, 2);
    const rest = viewers.length - shown.length;
    const ring =
        on === 'card'
            ? 'ring-2 ring-surface dark:ring-surface-2'
            : 'ring-2 ring-surface';

    return (
        <span
            aria-hidden
            title={viewersLabel(viewers) ?? undefined}
            data-presence="viewers"
            className={cn(
                'relative flex shrink-0 animate-in items-center -space-x-1.5 duration-180 ease-brand fade-in-0',
                className,
            )}
        >
            {shown.map((person) => (
                <UserAvatar
                    key={person.id}
                    name={person.name}
                    src={person.avatar}
                    className={cn('size-5 text-[9px]', ring)}
                />
            ))}
            {rest > 0 && (
                <span
                    className={cn(
                        'flex size-5 items-center justify-center rounded-full bg-surface-2 text-[9px] font-semibold text-text-muted dark:bg-border',
                        ring,
                    )}
                >
                    +{rest}
                </span>
            )}
            <span
                className={cn(
                    'absolute -right-0.5 -bottom-0.5 size-2 rounded-full bg-success',
                    ring,
                )}
            />
        </span>
    );
}

/** "· sedang diedit oleh Sari" next to the task key (pencil pulses unless reduced motion). */
export function TypingNote({
    presence,
    className,
}: {
    presence: TaskPresence | undefined;
    className?: string;
}) {
    const label = typingLabel(presence);

    if (!label) {
        return null;
    }

    return (
        <span
            aria-hidden
            title={label}
            data-presence="typing"
            className={cn(
                'inline-flex min-w-0 animate-in items-center gap-1 text-meta font-medium text-primary duration-180 ease-brand fade-in-0',
                className,
            )}
        >
            <Pencil
                className="size-3.5 shrink-0 motion-safe:animate-pulse"
                aria-hidden
            />
            <span className="truncate">{label}</span>
        </span>
    );
}

/** Text for the card/row aria-label: ", sedang dilihat Sari, sedang diedit oleh Sari". */
export function presenceDescription(
    presence: TaskPresence | undefined,
): string {
    const parts = [
        viewersLabel(presence?.viewers ?? [])?.toLowerCase(),
        typingLabel(presence),
    ].filter((part): part is string => Boolean(part));

    return parts.length > 0 ? `, ${parts.join(', ')}` : '';
}
