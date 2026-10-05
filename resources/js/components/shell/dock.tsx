import { Link, usePage } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import { Layers, Settings2 } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { forwardRef } from 'react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUnreadCount } from '@/features/notifications/unread-store';
import { workspaceInitial } from '@/features/workspaces/lib';
import type { SidebarWorkspace } from '@/features/workspaces/types';
import {
    useSidebarWorkspaces,
    workspacePath,
} from '@/features/workspaces/use-sidebar-workspaces';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { useDockMagnification } from '@/hooks/use-dock-magnification';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import type { AppNavItem } from '@/lib/navigation';
import {
    adminNavItems,
    attendanceNavItems,
    isActivePath,
    mainNavItemsFor,
} from '@/lib/navigation';
import type { PaletteColor } from '@/lib/palette';
import { isPaletteColor, palette } from '@/lib/palette';
import { cn } from '@/lib/utils';

/** Resting and magnified tile sizes (px); the Dock bar itself never grows taller. */
const BASE = 46;
const MAX = 74;
const RANGE = 150;
/** Favourite workspaces shown as their own tiles; the rest live in the stack. */
const MAX_FAVOURITES = 4;

type Motion = {
    name: string;
    duration?: string;
    timing?: string;
};

/** App-icon colour and hover loop per destination (seamless: identity at 0% and 100%). */
const LOOKS: Record<string, { color: PaletteColor; motion: Motion }> = {
    '/inbox': {
        color: 'blue',
        motion: { name: 'dock-drop', duration: '1.4s' },
    },
    '/tugas': {
        color: 'green',
        motion: { name: 'dock-pulse', duration: '1.5s' },
    },
    '/dashboard': {
        color: 'teal',
        motion: { name: 'dock-breathe', duration: '2.2s' },
    },
    '/portofolio': {
        color: 'violet',
        motion: { name: 'dock-tilt', duration: '1.8s' },
    },
    '/absensi': {
        color: 'orange',
        motion: { name: 'dock-drop', duration: '1.4s' },
    },
    '/pengajuan': {
        color: 'amber',
        motion: { name: 'dock-tilt', duration: '1.8s' },
    },
    '/persetujuan': {
        color: 'pink',
        motion: { name: 'dock-nudge', duration: '1.5s' },
    },
    '/organisasi/struktur': {
        color: 'gray',
        motion: { name: 'dock-breathe', duration: '2.2s' },
    },
};

const DEFAULT_LOOK = {
    color: 'slate' as PaletteColor,
    motion: { name: 'dock-lift' },
};

function motionStyle(motion: Motion): CSSProperties {
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
    color: PaletteColor | 'personal';
    motion: Motion;
    children: ReactNode;
    className?: string;
};

/** Squircle face with a soft top highlight, like a macOS app icon. */
function TileFace({
    color,
    children,
}: {
    color: TileProps['color'];
    children: ReactNode;
}) {
    return (
        <span
            className={cn(
                'dock-face relative flex size-full items-center justify-center overflow-hidden rounded-[23%] shadow-card ring-1 ring-glass-border',
                color === 'personal'
                    ? 'bg-surface-2 text-text-muted'
                    : cn(palette(color).bg, 'text-on-brand'),
            )}
        >
            <span
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-linear-to-b from-on-brand/28 via-on-brand/5 to-transparent"
            />
            {children}
        </span>
    );
}

/** Label pill above the tile, the active "running" dot below it, and a count badge. */
function TileChrome({
    label,
    active,
    badge,
}: Pick<TileProps, 'label' | 'active' | 'badge'>) {
    return (
        <>
            <span
                aria-hidden
                className="dock-label glass pointer-events-none absolute bottom-[calc(100%+12px)] left-1/2 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap text-text shadow-card"
            >
                {label}
            </span>
            {badge !== undefined && badge > 0 && (
                <span
                    aria-hidden
                    className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[11px] font-semibold text-on-danger tnum shadow-card ring-2 ring-background"
                >
                    {badge > 99 ? '99+' : badge}
                </span>
            )}
            {active && (
                <span
                    aria-hidden
                    className="absolute -bottom-[5px] left-1/2 size-1 -translate-x-1/2 rounded-full bg-text"
                />
            )}
        </>
    );
}

const DockLink = forwardRef<HTMLAnchorElement, TileProps & { href: string }>(
    function DockLink(
        { label, active, badge, color, motion, children, href, className },
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
                className={cn(
                    'dock-tile relative block shrink-0 rounded-[23%] focus-visible:outline-none focus-visible:[&>.dock-face]:ring-2 focus-visible:[&>.dock-face]:ring-ring',
                    className,
                )}
            >
                <TileFace color={color}>{children}</TileFace>
                <TileChrome label={label} active={active} badge={badge} />
            </Link>
        );
    },
);

const DockButton = forwardRef<
    HTMLButtonElement,
    TileProps & Omit<React.ComponentPropsWithoutRef<'button'>, 'color'>
>(function DockButton(
    { label, active, badge, color, motion, children, className, ...rest },
    ref,
) {
    return (
        <button
            ref={ref}
            type="button"
            aria-label={label}
            style={motionStyle(motion)}
            className={cn(
                'dock-tile relative block shrink-0 rounded-[23%] focus-visible:outline-none focus-visible:[&>.dock-face]:ring-2 focus-visible:[&>.dock-face]:ring-ring data-[state=open]:[&>.dock-label]:opacity-0',
                className,
            )}
            {...rest}
        >
            <TileFace color={color}>{children}</TileFace>
            <TileChrome label={label} active={active} badge={badge} />
        </button>
    );
});

function Separator() {
    return (
        <li
            aria-hidden
            className="mx-1 h-9 w-px self-center bg-border-strong/70"
        />
    );
}

function Glyph({ icon: Icon }: { icon: LucideIcon }) {
    return (
        <Icon aria-hidden className="dock-glyph relative" strokeWidth={1.9} />
    );
}

function WorkspaceGlyph({
    workspace,
    ownerName,
}: {
    workspace: SidebarWorkspace;
    ownerName?: string | null;
}) {
    return (
        <span
            aria-hidden
            className="dock-glyph relative flex items-center justify-center font-semibold"
            style={{ fontSize: 'calc(var(--dock-size, 46px) * 0.4)' }}
        >
            {workspaceInitial(workspace.name, workspace.type, ownerName)}
        </span>
    );
}

type StackEntry = {
    key: string;
    label: string;
    href: string;
    icon: ReactNode;
    active: boolean;
};

/** macOS "stack": one tile that opens a grid of destinations above the Dock. */
function DockStack({
    id,
    label,
    icon,
    color,
    motion,
    entries,
    register,
}: {
    id: string;
    label: string;
    icon: LucideIcon;
    color: PaletteColor;
    motion: Motion;
    entries: StackEntry[];
    register: (id: string) => (element: HTMLElement | null) => void;
}) {
    const active = entries.some((entry) => entry.active);

    return (
        <li className="flex items-end">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <DockButton
                        ref={register(id)}
                        label={label}
                        active={active}
                        color={color}
                        motion={motion}
                    >
                        <Glyph icon={icon} />
                    </DockButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    side="top"
                    align="center"
                    sideOffset={18}
                    className="glass w-[min(360px,90vw)] rounded-2xl p-2"
                >
                    <DropdownMenuLabel className="px-2 pt-1 pb-2 text-[11px] font-medium tracking-[.04em] text-text-muted uppercase">
                        {label}
                    </DropdownMenuLabel>
                    <div className="grid grid-cols-3 gap-1">
                        {entries.map((entry) => (
                            <DropdownMenuItem
                                key={entry.key}
                                asChild
                                className="p-0"
                            >
                                <Link
                                    href={entry.href}
                                    prefetch
                                    aria-current={
                                        entry.active ? 'page' : undefined
                                    }
                                    className={cn(
                                        'flex flex-col items-center gap-1.5 rounded-xl px-1 py-2.5 text-center text-xs leading-tight text-text',
                                        entry.active &&
                                            'bg-primary/10 text-primary',
                                    )}
                                >
                                    {entry.icon}
                                    <span className="line-clamp-2">
                                        {entry.label}
                                    </span>
                                </Link>
                            </DropdownMenuItem>
                        ))}
                    </div>
                </DropdownMenuContent>
            </DropdownMenu>
        </li>
    );
}

function StackIcon({
    icon: Icon,
    color,
}: {
    icon: LucideIcon;
    color: PaletteColor;
}) {
    return (
        <span
            aria-hidden
            className={cn(
                'flex size-9 items-center justify-center rounded-[23%] text-on-brand shadow-card',
                palette(color).bg,
            )}
        >
            <Icon className="size-[18px]" strokeWidth={1.9} />
        </span>
    );
}

/**
 * Desktop navigation as a floating macOS-style Dock. Tiles magnify with a
 * critically damped spring that follows the pointer (interruptible, starts from
 * the on-screen size), each glyph loops a small seamless motion on hover, and
 * the bar keeps a fixed height so magnified tiles rise above it, like macOS.
 */
export function Dock({ magnify }: { magnify: boolean }) {
    const { auth, approvals } = usePage().props;
    const { currentUrl } = useCurrentUrl();
    const unread = useUnreadCount();
    const reducedMotion = useReducedMotion();
    const workspaces = useSidebarWorkspaces();
    const { register, onPointerMove, onPointerLeave } = useDockMagnification({
        base: BASE,
        max: MAX,
        range: RANGE,
        enabled: magnify && !reducedMotion,
    });

    const main = mainNavItemsFor(auth.roles);
    const badgeFor = (item: AppNavItem): number | undefined => {
        if (item.href === '/inbox') {
            return unread;
        }

        return item.badge === 'approvals'
            ? (approvals?.pending ?? 0)
            : undefined;
    };

    const favourites = workspaces
        .filter((workspace) => workspace.favorite)
        .slice(0, MAX_FAVOURITES);
    const workspaceEntries: StackEntry[] = workspaces.map((workspace) => {
        const href = workspacePath(workspace.key);

        return {
            key: workspace.id,
            label: workspace.type === 'personal' ? 'Pribadi' : workspace.name,
            href,
            active: currentUrl === href || currentUrl.startsWith(`${href}/`),
            icon: (
                <span
                    aria-hidden
                    className={cn(
                        'flex size-9 items-center justify-center rounded-[23%] text-sm font-semibold shadow-card',
                        workspace.type === 'personal'
                            ? 'bg-surface-2 text-text-muted ring-1 ring-border'
                            : cn(palette(workspace.color).bg, 'text-on-brand'),
                    )}
                >
                    {workspaceInitial(
                        workspace.name,
                        workspace.type,
                        auth.user?.name,
                    )}
                </span>
            ),
        };
    });
    workspaceEntries.push({
        key: 'all-workspaces',
        label: 'Semua workspace',
        href: '/workspace',
        active: currentUrl === '/workspace',
        icon: <StackIcon icon={Layers} color="slate" />,
    });

    const adminEntries: StackEntry[] = [
        ...attendanceNavItems(auth.roles),
        ...adminNavItems(auth.roles),
    ].map((item) => ({
        key: item.href + item.title,
        label: item.title,
        href: item.href,
        active: isActivePath(item, currentUrl),
        icon: <StackIcon icon={item.icon} color="gray" />,
    }));

    return (
        <nav
            aria-label="Navigasi utama"
            className="pointer-events-none fixed inset-x-0 bottom-(--screen-gutter) z-40 flex justify-center"
        >
            <ul
                onPointerMove={onPointerMove}
                onPointerLeave={onPointerLeave}
                className="glass pointer-events-auto flex h-[calc(var(--dock-tile)+2*var(--dock-pad))] items-end gap-1.5 rounded-[22px] px-(--dock-pad) pb-(--dock-pad) shadow-(--dock-shadow)"
            >
                {main.map((item) => {
                    const look = LOOKS[item.href] ?? DEFAULT_LOOK;

                    return (
                        <li key={item.href} className="flex items-end">
                            <DockLink
                                ref={register(item.href)}
                                href={item.href}
                                label={item.title}
                                active={isActivePath(item, currentUrl)}
                                badge={badgeFor(item)}
                                color={look.color}
                                motion={look.motion}
                            >
                                <Glyph icon={item.icon} />
                            </DockLink>
                        </li>
                    );
                })}

                {(favourites.length > 0 || workspaceEntries.length > 0) && (
                    <Separator />
                )}

                {favourites.map((workspace) => {
                    const href = workspacePath(workspace.key);

                    return (
                        <li key={workspace.id} className="flex items-end">
                            <DockLink
                                ref={register(`ws-${workspace.id}`)}
                                href={href}
                                label={
                                    workspace.type === 'personal'
                                        ? 'Pribadi'
                                        : workspace.name
                                }
                                active={
                                    currentUrl === href ||
                                    currentUrl.startsWith(`${href}/`)
                                }
                                color={
                                    workspace.type === 'personal'
                                        ? 'personal'
                                        : isPaletteColor(workspace.color)
                                          ? workspace.color
                                          : 'gray'
                                }
                                motion={{ name: 'dock-lift' }}
                            >
                                <WorkspaceGlyph
                                    workspace={workspace}
                                    ownerName={auth.user?.name}
                                />
                            </DockLink>
                        </li>
                    );
                })}

                <DockStack
                    id="stack-workspaces"
                    label="Workspace"
                    icon={Layers}
                    color="blue"
                    motion={{ name: 'dock-lift' }}
                    entries={workspaceEntries}
                    register={register}
                />

                {adminEntries.length > 0 && (
                    <DockStack
                        id="stack-admin"
                        label="Admin"
                        icon={Settings2}
                        color="gray"
                        motion={{
                            name: 'dock-turn',
                            duration: '3.2s',
                            timing: 'linear',
                        }}
                        entries={adminEntries}
                        register={register}
                    />
                )}
            </ul>
        </nav>
    );
}
