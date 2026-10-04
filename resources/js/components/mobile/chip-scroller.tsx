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

/** Horizontally scrolling filter chips (single choice). */
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
                '-mx-4 flex snap-x [scrollbar-width:none] gap-2 overflow-x-auto px-4 pb-1 [&::-webkit-scrollbar]:hidden',
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
                            'flex h-9 shrink-0 snap-start items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors duration-120 ease-brand focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                            active
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border bg-surface text-text-muted',
                        )}
                    >
                        {chip.label}
                        {chip.count !== undefined && (
                            <span className="text-xs tnum opacity-80">
                                {chip.count}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
