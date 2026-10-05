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

/** Segmented control Sistem / Terang / Gelap (Komponen "Pilihan & tab", MMenu). */
export function ThemeSegmented({ className, size = 'md' }: Props) {
    const { appearance, updateAppearance } = useAppearance();

    return (
        <div
            role="radiogroup"
            aria-label="Tampilan"
            className={cn(
                'inline-flex gap-1 rounded-[14px] bg-surface-2 p-1',
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
                            'rounded-[10px] font-semibold transition-[color,background-color,box-shadow] duration-120 ease-brand outline-none focus-visible:ring-[3px] focus-visible:ring-ring',
                            size === 'sm'
                                ? 'h-8 px-3 text-[14px]'
                                : 'h-[38px] px-[18px] text-[15px]',
                            active
                                ? 'bg-surface text-text shadow-segment'
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
