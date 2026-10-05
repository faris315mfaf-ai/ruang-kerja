import { Check } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { PaletteColor } from '@/lib/palette';
import { PALETTE_COLORS, PALETTE_LABELS, palette } from '@/lib/palette';
import { cn } from '@/lib/utils';

type Props = {
    label: string;
    value: string;
    disabled?: boolean;
    onChange: (color: PaletteColor) => void;
};

/** Swatch button + palette menu (colors are palette names, never hex). */
export function ColorSelect({ label, value, disabled, onChange }: Props) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={disabled}>
                <button
                    type="button"
                    aria-label={`${label}: ${PALETTE_LABELS[value as PaletteColor] ?? value}`}
                    className="flex size-8 items-center justify-center rounded-md hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
                >
                    <span
                        aria-hidden
                        className={cn(
                            'size-4 rounded-full ring-1 ring-border',
                            palette(value).bg,
                        )}
                    />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
                {PALETTE_COLORS.map((color) => (
                    <DropdownMenuItem
                        key={color}
                        onSelect={() => onChange(color)}
                    >
                        <span
                            aria-hidden
                            className={cn(
                                'size-3 rounded-full',
                                palette(color).bg,
                            )}
                        />
                        {PALETTE_LABELS[color]}
                        {color === value && <Check className="ml-auto" />}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
