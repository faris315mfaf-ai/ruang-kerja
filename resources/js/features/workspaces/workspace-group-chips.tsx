import { cn, focusRing } from '@/lib/utils';
import type { WorkspaceFilter } from './groups';
import { WORKSPACE_GROUPS } from './groups';

type Props = {
    value: WorkspaceFilter;
    counts: Record<WorkspaceFilter, number>;
    onChange: (value: WorkspaceFilter) => void;
    /** Show the "Lainnya" chip (people who see workspaces without membership). */
    withOther: boolean;
    className?: string;
};

/**
 * Filter chips Semua · Pribadi · Divisi & tim · Proyek (· Lainnya), each with
 * the dot colour of its section; the active chip is the action gradient
 * (Arus). Scrolls horizontally on phones.
 */
export function WorkspaceGroupChips({
    value,
    counts,
    onChange,
    withOther,
    className,
}: Props) {
    const chips: { value: WorkspaceFilter; label: string; dot?: string }[] = [
        { value: 'semua', label: 'Semua' },
        ...WORKSPACE_GROUPS.filter(
            (group) => group.key !== 'lainnya' || withOther,
        ).map((group) => ({
            value: group.key,
            label: group.chip,
            dot: group.dot,
        })),
    ];

    return (
        <div
            role="radiogroup"
            aria-label="Kelompok workspace"
            className={cn(
                '-mx-4 flex snap-x scroll-px-4 [scrollbar-width:none] gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden',
                className,
            )}
        >
            {chips.map((chip) => {
                const active = chip.value === value;

                return (
                    <button
                        key={chip.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => onChange(chip.value)}
                        className={cn(
                            'flex h-11 shrink-0 snap-start items-center gap-2 rounded-full px-4 text-[16px] font-bold transition-colors duration-120 ease-brand md:h-10 md:text-[15px]',
                            focusRing,
                            active
                                ? 'bg-primary bg-grad-aksi text-on-brand shadow-button'
                                : 'border border-border-strong bg-surface text-text hover:bg-surface-2',
                        )}
                    >
                        {chip.dot && (
                            <span
                                aria-hidden
                                className={cn(
                                    'size-2.5 shrink-0 rounded-full',
                                    chip.dot,
                                    active && 'ring-2 ring-on-brand/80',
                                )}
                            />
                        )}
                        {chip.label}
                        <span className="text-[14px] font-semibold tnum opacity-80">
                            {counts[chip.value]}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
