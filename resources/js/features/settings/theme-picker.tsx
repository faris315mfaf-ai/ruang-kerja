import type { Appearance } from '@/hooks/use-appearance';
import { useAppearance } from '@/hooks/use-appearance';
import { ThemeSegmented } from '@/components/shell/theme-segmented';
import { cn, focusRing } from '@/lib/utils';

/*
 * Theme previews. The dark swatch is a `.dark` subtree so it shows the night
 * background in both themes; the light one uses the fixed paper token (white
 * in both themes) for the same reason.
 */
function Swatch({ value }: { value: Appearance }) {
    const light = <span className="flex-1 bg-qr-paper" />;
    const dark = <span className="dark flex-1 bg-background" />;

    return (
        <span
            aria-hidden
            className="flex h-16 overflow-hidden rounded-[10px] border border-border"
        >
            {value === 'light' && light}
            {value === 'dark' && dark}
            {value === 'system' && (
                <>
                    {light}
                    {dark}
                </>
            )}
        </span>
    );
}

const OPTIONS: { value: Appearance; label: string }[] = [
    { value: 'light', label: 'Terang' },
    { value: 'dark', label: 'Gelap' },
    { value: 'system', label: 'Ikuti sistem' },
];

/**
 * Theme choice as three preview cards (SPengaturan "Tampilan"). Phones use
 * the segmented control (MSPengaturan) instead.
 */
export function ThemePicker({ className }: { className?: string }) {
    const { appearance, updateAppearance } = useAppearance();

    return (
        <div
            role="radiogroup"
            aria-label="Tema"
            className={cn('grid grid-cols-3 gap-2.5', className)}
        >
            {OPTIONS.map((option) => {
                const selected = appearance === option.value;

                return (
                    <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => updateAppearance(option.value)}
                        className={cn(
                            'flex min-w-0 flex-col gap-2 rounded-lg bg-surface p-2.5 text-left transition-[border-color,box-shadow] duration-120 ease-brand',
                            selected
                                ? 'border-2 border-primary p-[9px]'
                                : 'border border-border hover:border-border-strong',
                            focusRing,
                        )}
                    >
                        <Swatch value={option.value} />
                        <span className="truncate text-label font-bold">
                            {option.label}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

/** Cards from tablet up, the full-width segmented control on phones. */
export function ThemeChoice() {
    return (
        <>
            <ThemePicker className="hidden md:grid" />
            <ThemeSegmented className="flex w-full md:hidden [&>button]:h-11 [&>button]:flex-1" />
        </>
    );
}
