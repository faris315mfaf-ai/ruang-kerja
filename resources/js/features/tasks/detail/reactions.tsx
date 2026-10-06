import { SmilePlus } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { ReactionGroup } from './types';

type Props = {
    groups: ReactionGroup[];
    available: string[];
    viewerId: string | undefined;
    canReact: boolean;
    mobile?: boolean;
    onToggle: (emoji: string) => void;
};

/** Emoji reaction chips (count, pressed when mine) + picker. */
export function Reactions({
    groups,
    available,
    viewerId,
    canReact,
    mobile = false,
    onToggle,
}: Props) {
    if (groups.length === 0 && !canReact) {
        return null;
    }

    const chip = cn(
        'hit-area inline-flex items-center gap-1.5 rounded-full border text-[14px] font-bold transition-colors duration-120 ease-brand focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none disabled:cursor-default',
        mobile ? 'h-9 px-3' : 'h-8 px-2.5',
    );

    return (
        <div className="flex flex-wrap items-center gap-1.5">
            {groups.map((group) => {
                const mine =
                    viewerId !== undefined && group.user_ids.includes(viewerId);

                return (
                    <button
                        key={group.emoji}
                        type="button"
                        disabled={!canReact}
                        aria-pressed={mine}
                        title={group.names.join(', ')}
                        aria-label={`${group.emoji} ${group.count}: ${group.names.join(', ')}`}
                        onClick={() => onToggle(group.emoji)}
                        className={cn(
                            chip,
                            mine
                                ? 'border-transparent bg-link-soft text-link'
                                : 'border-border text-text-muted hover:bg-surface-2',
                        )}
                    >
                        <span aria-hidden>{group.emoji}</span>
                        <span className="tnum">{group.count}</span>
                    </button>
                );
            })}
            {canReact && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            aria-label="Tambah reaksi"
                            className={cn(
                                chip,
                                'border-border text-text-muted hover:bg-surface-2 hover:text-text',
                                mobile
                                    ? 'w-9 justify-center px-0'
                                    : 'w-8 justify-center px-0',
                            )}
                        >
                            <SmilePlus className="size-4" aria-hidden />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        align="start"
                        className="grid w-auto grid-cols-4 gap-0.5 p-1"
                    >
                        {available.map((emoji) => (
                            <DropdownMenuItem
                                key={emoji}
                                onSelect={() => onToggle(emoji)}
                                className="justify-center text-lg"
                                aria-label={`Reaksi ${emoji}`}
                            >
                                {emoji}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
        </div>
    );
}
