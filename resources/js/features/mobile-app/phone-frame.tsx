import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * 390×844 phone bezel used on desktop/tablet to preview native screens
 * (lock screen, widget, biometric login). On phones the same screen fills
 * the viewport instead, so the frame never renders below 768px.
 */
export function PhoneFrame({
    children,
    label,
    className,
}: {
    children: ReactNode;
    /** Accessible name of the simulated device ("Pratinjau layar kunci"). */
    label: string;
    className?: string;
}) {
    return (
        <figure
            aria-label={label}
            className={cn(
                'relative h-[864px] w-[410px] shrink-0 rounded-[60px] border-[10px] border-preview-dark bg-preview-dark shadow-float ring-1 ring-border-strong',
                className,
            )}
        >
            <span
                aria-hidden
                className="absolute top-3 left-1/2 z-40 h-[30px] w-[112px] -translate-x-1/2 rounded-full bg-preview-dark"
            />
            <div className="relative h-full w-full overflow-hidden rounded-[50px] bg-background text-text">
                {children}
            </div>
        </figure>
    );
}

/** Fake OS status bar (time left, network & battery right). */
export function StatusBar({
    time,
    tone = 'light',
    className,
}: {
    time: string;
    /** `light` = white glyphs on a wallpaper, `auto` = theme text. */
    tone?: 'light' | 'auto';
    className?: string;
}) {
    return (
        <div
            aria-hidden
            className={cn(
                'flex h-[50px] shrink-0 items-end justify-between px-7 pb-1.5 text-[15px] font-bold tnum',
                tone === 'light' ? 'text-on-brand' : 'text-text',
                className,
            )}
        >
            <span>{time}</span>
            <span className="flex items-center gap-1.5">
                <span className="flex items-end gap-[2px]">
                    {[5, 7, 9, 11].map((h) => (
                        <span
                            key={h}
                            className="w-[3px] rounded-[1px] bg-current"
                            style={{ height: h }}
                        />
                    ))}
                </span>
                <span>5G</span>
                <span className="relative ml-0.5 h-[12px] w-[24px] rounded-[4px] border-[1.5px] border-current p-[1.5px]">
                    <span className="block h-full w-[64%] rounded-[2px] bg-current" />
                </span>
            </span>
        </div>
    );
}

/** iOS home indicator. */
export function HomeIndicator({ tone = 'light' }: { tone?: 'light' | 'auto' }) {
    return (
        <span
            aria-hidden
            className={cn(
                'absolute bottom-2 left-1/2 z-30 h-[5px] w-[134px] -translate-x-1/2 rounded-full',
                tone === 'light' ? 'bg-on-brand' : 'bg-text',
            )}
        />
    );
}

const mix = (token: string, pct: number) =>
    `color-mix(in srgb, var(${token}) ${pct}%, transparent)`;

/**
 * OS wallpapers of MLogin / MLockScreen / MWidget. They stay dark in both
 * themes (it is the phone's wallpaper, not app chrome); colours come from
 * the fixed fill tokens via color-mix, never hex.
 */
export const WALLPAPERS = {
    login: {
        backgroundColor: 'var(--preview-dark)',
        backgroundImage: [
            `radial-gradient(420px 360px at 0% 0%, ${mix('--fill-teal', 55)}, transparent 70%)`,
            `radial-gradient(420px 360px at 100% 30%, ${mix('--accent-blue', 55)}, transparent 70%)`,
            `radial-gradient(360px 300px at 50% 100%, ${mix('--fill-violet', 45)}, transparent 70%)`,
        ].join(', '),
    },
    lock: {
        backgroundColor: 'var(--preview-dark)',
        backgroundImage: [
            `radial-gradient(400px 360px at 0% 20%, ${mix('--fill-teal', 65)}, transparent 70%)`,
            `radial-gradient(400px 360px at 100% 60%, ${mix('--accent-blue', 60)}, transparent 70%)`,
        ].join(', '),
    },
    home: {
        backgroundColor: 'var(--brand-900)',
        backgroundImage: [
            `radial-gradient(360px 300px at 10% 10%, ${mix('--brand-400', 100)}, transparent 70%)`,
            `radial-gradient(380px 340px at 100% 40%, ${mix('--accent-blue', 100)}, transparent 70%)`,
            `radial-gradient(360px 320px at 30% 100%, ${mix('--fill-violet', 100)}, transparent 70%)`,
        ].join(', '),
    },
} satisfies Record<string, CSSProperties>;

/** Full-bleed wallpaper container for OS screens. */
export function Wallpaper({
    kind,
    children,
    className,
}: {
    kind: keyof typeof WALLPAPERS;
    children: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'relative flex h-full min-h-0 flex-col overflow-hidden text-on-brand',
                className,
            )}
            style={WALLPAPERS[kind]}
        >
            {children}
        </div>
    );
}
