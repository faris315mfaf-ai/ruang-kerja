/**
 * Named palette for labels, status columns and workspace avatars.
 * The database stores the palette NAME; colors live in resources/css/palette.css.
 * Class names are written out in full so Tailwind can see them.
 */
export const PALETTE_COLORS = [
    'gray',
    'slate',
    'teal',
    'blue',
    'green',
    'amber',
    'orange',
    'red',
    'violet',
    'pink',
] as const;

export type PaletteColor = (typeof PALETTE_COLORS)[number];

type PaletteClasses = {
    /** Solid fill: dots, avatars. */
    bg: string;
    /** Foreground/icon color. */
    text: string;
    /** Tinted background for pills. */
    soft: string;
    /** Border tint. */
    border: string;
};

const CLASSES: Record<PaletteColor, PaletteClasses> = {
    gray: {
        bg: 'bg-tag-gray',
        text: 'text-tag-gray',
        soft: 'bg-tag-gray/12',
        border: 'border-tag-gray/40',
    },
    slate: {
        bg: 'bg-tag-slate',
        text: 'text-tag-slate',
        soft: 'bg-tag-slate/12',
        border: 'border-tag-slate/40',
    },
    teal: {
        bg: 'bg-tag-teal',
        text: 'text-tag-teal',
        soft: 'bg-tag-teal/12',
        border: 'border-tag-teal/40',
    },
    blue: {
        bg: 'bg-tag-blue',
        text: 'text-tag-blue',
        soft: 'bg-tag-blue/12',
        border: 'border-tag-blue/40',
    },
    green: {
        bg: 'bg-tag-green',
        text: 'text-tag-green',
        soft: 'bg-tag-green/12',
        border: 'border-tag-green/40',
    },
    amber: {
        bg: 'bg-tag-amber',
        text: 'text-tag-amber',
        soft: 'bg-tag-amber/12',
        border: 'border-tag-amber/40',
    },
    orange: {
        bg: 'bg-tag-orange',
        text: 'text-tag-orange',
        soft: 'bg-tag-orange/12',
        border: 'border-tag-orange/40',
    },
    red: {
        bg: 'bg-tag-red',
        text: 'text-tag-red',
        soft: 'bg-tag-red/12',
        border: 'border-tag-red/40',
    },
    violet: {
        bg: 'bg-tag-violet',
        text: 'text-tag-violet',
        soft: 'bg-tag-violet/12',
        border: 'border-tag-violet/40',
    },
    pink: {
        bg: 'bg-tag-pink',
        text: 'text-tag-pink',
        soft: 'bg-tag-pink/12',
        border: 'border-tag-pink/40',
    },
};

export const PALETTE_LABELS: Record<PaletteColor, string> = {
    gray: 'Abu-abu',
    slate: 'Batu',
    teal: 'Teal',
    blue: 'Biru',
    green: 'Hijau',
    amber: 'Kuning',
    orange: 'Oranye',
    red: 'Merah',
    violet: 'Ungu',
    pink: 'Merah muda',
};

export function isPaletteColor(value: unknown): value is PaletteColor {
    return (
        typeof value === 'string' &&
        (PALETTE_COLORS as readonly string[]).includes(value)
    );
}

/** Classes for a palette name; unknown values fall back to gray. */
export function palette(color: string | null | undefined): PaletteClasses {
    return CLASSES[isPaletteColor(color) ? color : 'gray'];
}
