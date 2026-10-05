import { Link } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { forwardRef } from 'react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDockMagnification } from '@/hooks/use-dock-magnification';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { cn } from '@/lib/utils';
import type { GlyphMotion, NavStack } from './use-shell-navigation';
import { useShellNavigation } from './use-shell-navigation';

/** Resting and magnified tile sizes (px, Dock.dc.html "Kuat" ×1.42). */
const BASE = 52;
const MAX = 74;
const RANGE = 150;

export function motionStyle(motion: GlyphMotion): CSSProperties {
    return {
        '--dock-motion': motion.name,
        '--dock-motion-duration': motion.duration ?? '1.6s',
        '--dock-motion-timing': motion.timing ?? 'ease-in-out',
    } as CSSProperties;
}

type TileProps = {
    label: string;
    active?: boolean;
    badge?: number;
    motion: GlyphMotion;
    /** Workspace tile: gradient (bg-grad-*) with a white letter. */
    gradient?: string;
    children: ReactNode;
    className?: string;
};

/** App-icon face: white tile (dark at night), gradient when active or a workspace. */
function TileFace({
    active,
    gradient,
    children,
}: Pick<TileProps, 'active' | 'gradient' | 'children'>) {
    return (
        <span
            data-active={active && !gradient ? 'true' : undefined}
            data-letter={gradient ? 'true' : undefined}
            className={cn(
                'dock-face relative flex size-full items-center justify-center overflow-hidden',
                gradient,
            )}
        >
            {children}
        </span>
    );
}

/** Label chip above the tile, the active dot below it, and a count badge. */
function TileChrome({
    label,
    active,
    badge,
}: Pick<TileProps, 'label' | 'active' | 'badge'>) {
    return (
        <>
            <span
                aria-hidden
                className="dock-label pointer-events-none absolute bottom-[calc(100%+14px)] left-1/2 rounded-[10px] bg-inverse px-3 py-1.5 text-[14px] leading-[18px] font-semibold whitespace-nowrap text-on-inverse shadow-inverse"
            >
                {label}
            </span>
            {badge !== undefined && badge > 0 && (
                <span
                    aria-hidden
                    className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-badge px-1.5 text-[12px] leading-5 font-bold text-on-badge tnum ring-2 ring-(--dock-badge-ring)"
                >
                    {badge > 99 ? '99+' : badge}
                </span>
            )}
            {active && (
                <span
                    aria-hidden
                    className="absolute -bottom-2.5 left-1/2 size-[5px] -translate-x-1/2 rounded-full bg-text"
                />
            )}
        </>
    );
}

const tileClass =
    'dock-tile relative block shrink-0 rounded-[28%] outline-none focus-visible:[&>.dock-face]:ring-[3px] focus-visible:[&>.dock-face]:ring-ring';

const DockLink = forwardRef<HTMLAnchorElement, TileProps & { href: string }>(
    function DockLink(
        { label, active, badge, motion, gradient, children, href, className },
        ref,
    ) {
        return (
            <Link
                ref={ref}
                href={href}
                prefetch
                aria-label={badge ? `${label}, ${badge}` : label}
                aria-current={active ? 'page' : undefined}
                style={motionStyle(motion)}
                className={cn(tileClass, className)}
            >
                <TileFace active={active} gradient={gradient}>
                    {children}
                </TileFace>
                <TileChrome label={label} active={active} badge={badge} />
            </Link>
        );
    },
);

const DockButton = forwardRef<
    HTMLButtonElement,
    TileProps & Omit<React.ComponentPropsWithoutRef<'button'>, 'color'>
>(function DockButton(
    { label, active, badge, motion, gradient, children, className, ...rest },
    ref,
) {
    return (
        <button
            ref={ref}
            type="button"
            aria-label={label}
            style={motionStyle(motion)}
            className={cn(
                tileClass,
                'data-[state=open]:[&>.dock-label]:opacity-0',
                className,
            )}
            {...rest}
        >
            <TileFace active={active} gradient={gradient}>
                {children}
            </TileFace>
            <TileChrome label={label} active={active} badge={badge} />
        </button>
    );
});

function Separator() {
    return (
        <li
            aria-hidden
            className="mx-1 mb-[7px] h-[38px] w-px self-end bg-(--dock-divider)"
        />
    );
}

export function Glyph({ icon: Icon }: { icon: LucideIcon }) {
    return (
        <Icon aria-hidden className="dock-glyph relative" strokeWidth={1.9} />
    );
}

/** 52px gradient tile of a stack entry: workspace letter or white icon. */
export function StackTile({
    letter,
    icon: Icon,
    gradient,
    className,
}: {
    letter?: string;
    icon?: LucideIcon;
    gradient: string;
    className?: string;
}) {
    return (
        <span
            aria-hidden
            className={cn(
                'flex size-13 shrink-0 items-center justify-center rounded-[15px] text-[19px] font-extrabold text-on-brand shadow-(--dock-tile-shadow)',
                gradient,
                className,
            )}
        >
            {letter ??
                (Icon && (
                    <Icon className="size-6 text-on-brand" strokeWidth={1.9} />
                ))}
        </span>
    );
}

/** Popover grid of a stack (Dock.dc.html "Tumpukan"), shared with the Rail. */
export function StackContent({
    stack,
    side,
}: {
    stack: NavStack;
    side: 'top' | 'right';
}) {
    return (
        <DropdownMenuContent
            side={side}
            align={side === 'top' ? 'center' : 'start'}
            sideOffset={side === 'top' ? 22 : 14}
            className="glass-strong w-[372px] max-w-[90vw] rounded-2xl px-3.5 pt-4 pb-3.5 shadow-(--dock-shadow)"
        >
            <div className="flex items-baseline justify-between px-1.5 pb-2.5">
                <span className="text-[16px] font-bold text-text">
                    {stack.label}
                </span>
                {stack.allHref && (
                    <DropdownMenuItem
                        asChild
                        className="min-h-0 p-0 text-[14px] font-semibold text-link focus:bg-transparent focus:underline"
                    >
                        <Link href={stack.allHref} prefetch>
                            Lihat semua
                        </Link>
                    </DropdownMenuItem>
                )}
            </div>
            <div className="grid grid-cols-3 gap-1">
                {stack.entries.map((entry) => (
                    <DropdownMenuItem key={entry.key} asChild className="p-0">
                        <Link
                            href={entry.href}
                            prefetch
                            aria-current={entry.active ? 'page' : undefined}
                            className={cn(
                                'flex flex-col items-center gap-2 rounded-lg px-1 py-2.5 text-center text-[14px] leading-[18px] font-semibold text-text',
                                entry.active && 'bg-link-soft',
                            )}
                        >
                            <StackTile
                                letter={entry.letter}
                                icon={entry.icon}
                                gradient={entry.gradient}
                            />
                            <span className="line-clamp-2">{entry.label}</span>
                        </Link>
                    </DropdownMenuItem>
                ))}
            </div>
        </DropdownMenuContent>
    );
}

/** macOS "stack": one tile that opens a grid of destinations above the Dock. */
function DockStack({
    stack,
    register,
}: {
    stack: NavStack;
    register: (id: string) => (element: HTMLElement | null) => void;
}) {
    return (
        <li className="relative flex h-(--dock-tile) items-end">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <DockButton
                        ref={register(stack.id)}
                        label={stack.label}
                        active={stack.active}
                        motion={stack.motion}
                    >
                        <Glyph icon={stack.icon} />
                    </DockButton>
                </DropdownMenuTrigger>
                <StackContent stack={stack} side="top" />
            </DropdownMenu>
        </li>
    );
}

/**
 * Desktop navigation as a floating macOS-style Dock (Dock.dc.html). Tiles
 * magnify with a critically damped spring that follows the pointer
 * (interruptible, starts from the on-screen size), each glyph loops a small
 * seamless motion on hover, and the bar keeps a fixed height so magnified
 * tiles rise above it, like macOS.
 */
export function Dock() {
    const reducedMotion = useReducedMotion();
    const { tiles, organization, favourites, workspaces, admin } =
        useShellNavigation();
    const { register, onPointerMove, onPointerLeave } = useDockMagnification({
        base: BASE,
        max: MAX,
        range: RANGE,
        enabled: !reducedMotion,
    });

    return (
        <nav
            aria-label="Navigasi utama"
            className="pointer-events-none fixed inset-x-0 bottom-(--dock-bottom) z-40 flex justify-center px-3"
        >
            <ul
                onPointerMove={onPointerMove}
                onPointerLeave={onPointerLeave}
                className="dock-surface pointer-events-auto flex items-end gap-2 rounded-[30px] px-3 pt-(--dock-pad-top) pb-(--dock-pad-bottom)"
            >
                {tiles.map((tile) => (
                    <li
                        key={tile.key}
                        className="relative flex h-(--dock-tile) items-end"
                    >
                        <DockLink
                            ref={register(tile.key)}
                            href={tile.href}
                            label={tile.label}
                            active={tile.active}
                            badge={tile.badge}
                            motion={tile.motion}
                        >
                            <Glyph icon={tile.icon} />
                        </DockLink>
                    </li>
                ))}

                <Separator />

                {favourites.map((workspace) => (
                    <li
                        key={workspace.key}
                        className="relative flex h-(--dock-tile) items-end"
                    >
                        <DockLink
                            ref={register(workspace.key)}
                            href={workspace.href}
                            label={workspace.label}
                            active={workspace.active}
                            gradient={workspace.gradient}
                            motion={{ name: 'dock-lift' }}
                        >
                            <span
                                aria-hidden
                                className="dock-glyph relative flex items-center justify-center"
                            >
                                {workspace.letter}
                            </span>
                        </DockLink>
                    </li>
                ))}

                <DockStack stack={workspaces} register={register} />

                {(organization || admin) && <Separator />}

                {organization && (
                    <DockStack stack={organization} register={register} />
                )}

                {admin && <DockStack stack={admin} register={register} />}
            </ul>
        </nav>
    );
}
