import { cn } from '@/lib/utils';

export type Chip<T extends string> = {
    value: T;
    label: string;
    count?: number;
};

type Props<T extends string> = {
    chips: Chip<T>[];
    value: T;
    onChange: (value: T) => void;
    label: string;
    className?: string;
};

/**
 * Horizontally scrolling filter chips (single choice). Bleeds to the screen
 * edge (`-mx-4 px-4`); `scroll-px-4` keeps snapped chips off the edge.
 */
export function ChipScroller<T extends string>({
    chips,
    value,
    onChange,
    label,
    className,
}: Props<T>) {
    return (
        <div
            role="radiogroup"
            aria-label={label}
            className={cn(
                '-mx-4 flex snap-x scroll-px-4 [scrollbar-width:none] gap-2 overflow-x-auto px-4 pb-1 [&::-webkit-scrollbar]:hidden',
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
                            'hit-area flex h-[42px] shrink-0 snap-start items-center gap-1.5 rounded-full px-4 text-[16px] font-bold transition-colors duration-120 ease-brand outline-none focus-visible:ring-[3px] focus-visible:ring-ring',
                            active
                                ? 'bg-primary bg-grad-aksi text-on-brand'
                                : 'border border-border-strong bg-surface text-text',
                        )}
                    >
                        {chip.label}
                        {chip.count !== undefined && (
                            <span className="text-[14px] font-semibold tnum opacity-80">
                                {chip.count}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
