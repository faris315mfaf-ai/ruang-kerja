import { usePage } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import { Layers, LayoutGrid, ShieldCheck, Users } from 'lucide-react';
import { useUnreadCount } from '@/features/notifications/unread-store';
import { workspaceInitial } from '@/features/workspaces/lib';
import {
    useSidebarWorkspaces,
    workspacePath,
} from '@/features/workspaces/use-sidebar-workspaces';
import { useCurrentUrl } from '@/hooks/use-current-url';
import type { AppNavItem } from '@/lib/navigation';
import {
    adminNavItems,
    attendanceNavItems,
    isActivePath,
    chatNavItem,
    mainNavItemsFor,
    organizationNavItems,
    prototypeNavItem,
} from '@/lib/navigation';
import { paletteGradient } from '@/lib/palette';

/** Favourite workspaces shown as their own tiles; all of them live in the stack. */
export const MAX_FAVOURITES = 4;

/** Seamless hover loop of a glyph (identity transform at 0% and 100%). */
export type GlyphMotion = {
    name: string;
    duration?: string;
    timing?: string;
};

const MOTIONS: Record<string, GlyphMotion> = {
    '/dashboard': { name: 'dock-breathe', duration: '2.2s' },
    '/portofolio': { name: 'dock-tilt', duration: '1.8s' },
    '/manajemen': { name: 'dock-lift', duration: '1.6s' },
    '/inbox': { name: 'dock-drop', duration: '1.4s' },
    '/obrolan': { name: 'dock-nudge', duration: '1.5s' },
    '/tugas': { name: 'dock-pulse', duration: '1.5s' },
    '/absensi': { name: 'dock-drop', duration: '1.4s' },
    '/pengajuan': { name: 'dock-tilt', duration: '1.8s' },
    '/persetujuan': { name: 'dock-nudge', duration: '1.5s' },
    '/organisasi/struktur': { name: 'dock-breathe', duration: '2.2s' },
};

const DEFAULT_MOTION: GlyphMotion = { name: 'dock-lift' };

export type NavTile = {
    key: string;
    label: string;
    href: string;
    icon: LucideIcon;
    active: boolean;
    badge?: number;
    motion: GlyphMotion;
};

export type NavWorkspaceTile = {
    key: string;
    label: string;
    href: string;
    letter: string;
    /** bg-grad-* class (white letter on it). */
    gradient: string;
    active: boolean;
};

export type NavStackEntry = {
    key: string;
    label: string;
    href: string;
    active: boolean;
    /** Letter tile (workspaces) or icon tile (admin, organization). */
    letter?: string;
    icon?: LucideIcon;
    gradient: string;
};

export type NavStack = {
    id: string;
    label: string;
    icon: LucideIcon;
    motion: GlyphMotion;
    entries: NavStackEntry[];
    active: boolean;
    /** "Lihat semua" link in the stack header. */
    allHref?: string;
};

export type ShellNavigation = {
    tiles: NavTile[];
    organization: NavStack | null;
    favourites: NavWorkspaceTile[];
    workspaces: NavStack;
    admin: NavStack | null;
};

/** Stack entry gradients for icon tiles (Dock.dc.html STACKS alternate merek/indigo). */
const ICON_GRADIENTS = ['bg-grad-merek', 'bg-grad-indigo'] as const;

/**
 * One navigation model for the desktop Dock and the tablet Rail
 * (docs/PLATFORM.md §2): main destinations, favourite workspaces and the
 * Organisasi / Workspace / Admin stacks. Every destination appears once
 * among tiles + stacks, except favourites, which are also listed in the
 * Workspace stack (like the macOS Dock).
 */
export function useShellNavigation(): ShellNavigation {
    const { auth, approvals, features, chatUnread } = usePage().props;
    const { currentUrl } = useCurrentUrl();
    const unread = useUnreadCount();
    const workspaces = useSidebarWorkspaces();

    const badgeFor = (item: AppNavItem): number | undefined => {
        if (item.href === '/inbox') {
            return unread;
        }

        if (item.badge === 'chat') {
            return chatUnread ?? 0;
        }

        return item.badge === 'approvals'
            ? (approvals?.pending ?? 0)
            : undefined;
    };

    const toTile = (item: AppNavItem): NavTile => ({
        key: item.href,
        label: item.title,
        href: item.href,
        icon: item.icon,
        active: isActivePath(item, currentUrl),
        badge: badgeFor(item),
        motion: MOTIONS[item.href] ?? DEFAULT_MOTION,
    });

    const toEntries = (items: AppNavItem[]): NavStackEntry[] =>
        items.map((item, index) => ({
            key: item.href + item.title,
            label: item.title,
            href: item.href,
            active: isActivePath(item, currentUrl),
            icon: item.icon,
            gradient: ICON_GRADIENTS[index % ICON_GRADIENTS.length],
        }));

    const isCurrent = (href: string) =>
        currentUrl === href || currentUrl.startsWith(`${href}/`);
    const workspaceLabel = (name: string, type: string) =>
        type === 'personal' ? 'Pribadi' : name;
    const workspaceGradient = (type: string, color: string) =>
        type === 'personal' ? 'bg-grad-slate' : paletteGradient(color);

    const favourites: NavWorkspaceTile[] = workspaces
        .filter((workspace) => workspace.favorite)
        .slice(0, MAX_FAVOURITES)
        .map((workspace) => {
            const href = workspacePath(workspace.key);

            return {
                key: `ws-${workspace.id}`,
                label: workspaceLabel(workspace.name, workspace.type),
                href,
                letter: workspaceInitial(
                    workspace.name,
                    workspace.type,
                    auth.user?.name,
                ),
                gradient: workspaceGradient(workspace.type, workspace.color),
                active: isCurrent(href),
            };
        });

    const workspaceEntries: NavStackEntry[] = workspaces.map((workspace) => {
        const href = workspacePath(workspace.key);

        return {
            key: workspace.id,
            label: workspaceLabel(workspace.name, workspace.type),
            href,
            active: isCurrent(href),
            letter: workspaceInitial(
                workspace.name,
                workspace.type,
                auth.user?.name,
            ),
            gradient: workspaceGradient(workspace.type, workspace.color),
        };
    });
    workspaceEntries.push({
        key: 'all-workspaces',
        label: 'Semua workspace',
        href: '/workspace',
        active: currentUrl === '/workspace',
        icon: Layers,
        gradient: 'bg-grad-slate',
    });

    // A one-item stack is just a detour: roles that only see the org chart
    // get it as a plain tile instead.
    const organizationItems = organizationNavItems(auth.roles);
    const main = mainNavItemsFor(auth.roles);
    // Obrolan right after Inbox (messages next to notifications).
    const withChat = features?.chat
        ? main.flatMap((item) =>
              item.href === '/inbox' ? [item, chatNavItem] : [item],
          )
        : main;
    const tiles = [
        ...(organizationItems.length > 1
            ? withChat
            : [...withChat, ...organizationItems]),
        ...(features?.prototype ? [prototypeNavItem] : []),
    ].map(toTile);

    const organizationEntries = toEntries(organizationItems);
    const organization: NavStack | null =
        organizationItems.length > 1
            ? {
                  id: 'stack-organization',
                  label: 'Organisasi',
                  icon: Users,
                  motion: { name: 'dock-breathe', duration: '2.2s' },
                  entries: organizationEntries,
                  active: organizationEntries.some((entry) => entry.active),
              }
            : null;

    const adminEntries = toEntries([
        ...attendanceNavItems(auth.roles),
        ...adminNavItems(auth.roles),
    ]);
    const admin: NavStack | null =
        adminEntries.length > 0
            ? {
                  id: 'stack-admin',
                  label: 'Admin',
                  icon: ShieldCheck,
                  motion: {
                      name: 'dock-turn',
                      duration: '3.2s',
                      timing: 'linear',
                  },
                  entries: adminEntries,
                  active: adminEntries.some((entry) => entry.active),
              }
            : null;

    return {
        tiles,
        organization,
        favourites,
        workspaces: {
            id: 'stack-workspaces',
            label: 'Workspace',
            icon: LayoutGrid,
            motion: { name: 'dock-lift' },
            entries: workspaceEntries,
            // A favourite tile already marks the open workspace.
            active:
                workspaceEntries.some((entry) => entry.active) &&
                !favourites.some((tile) => tile.active),
            allHref: '/workspace',
        },
        admin,
    };
}
