import type { Appearance } from '@/hooks/use-appearance';
import { useAppearance } from '@/hooks/use-appearance';
import { cn } from '@/lib/utils';

const OPTIONS: { value: Appearance; label: string }[] = [
    { value: 'system', label: 'Sistem' },
    { value: 'light', label: 'Terang' },
    { value: 'dark', label: 'Gelap' },
];

type Props = {
    className?: string;
    size?: 'sm' | 'md';
};

/** Segmented control Sistem / Terang / Gelap (mockup MMenu). */
export function ThemeSegmented({ className, size = 'md' }: Props) {
    const { appearance, updateAppearance } = useAppearance();

    return (
        <div
            role="radiogroup"
            aria-label="Tampilan"
            className={cn(
                'inline-flex rounded-md border border-border bg-surface-2 p-0.5',
                className,
            )}
        >
            {OPTIONS.map((option) => {
                const active = appearance === option.value;

                return (
                    <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => updateAppearance(option.value)}
                        className={cn(
                            'rounded-sm font-medium transition-colors duration-120 ease-brand focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                            size === 'sm'
                                ? 'h-7 px-2.5 text-xs'
                                : 'h-9 px-2.5 text-sm',
                            active
                                ? 'bg-surface text-text shadow-card'
                                : 'text-text-muted hover:text-text',
                        )}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}
