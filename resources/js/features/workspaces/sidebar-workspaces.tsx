import { Link, router, usePage } from '@inertiajs/react';
import { ChevronRight, LayoutGrid, Star } from 'lucide-react';
import { useState } from 'react';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuAction,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { cn } from '@/lib/utils';
import { favorite, index, unfavorite } from '@/routes/workspaces';
import { groupByType } from './lib';
import type { SidebarWorkspace } from './types';
import { TYPE_GROUP_LABELS } from './types';
import { useSidebarWorkspaces, workspacePath } from './use-sidebar-workspaces';
import { WorkspaceAvatar } from './workspace-avatar';

const STORAGE_KEY = 'rk.sidebar.workspaces';

/** Show sub-group labels only when the list gets long. */
const GROUP_LABELS_FROM = 6;

function readCollapsed(): Record<string, boolean> {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);

        return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    } catch {
        return {};
    }
}

function writeCollapsed(value: Record<string, boolean>): void {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
        // Storage may be unavailable (private mode); collapsing still works.
    }
}

function WorkspaceItem({ workspace }: { workspace: SidebarWorkspace }) {
    const { currentUrl } = useCurrentUrl();
    const { auth } = usePage().props;
    const href = workspacePath(workspace.key);
    const active = currentUrl === href || currentUrl.startsWith(`${href}/`);
    const label = workspace.type === 'personal' ? 'Pribadi' : workspace.name;

    return (
        <SidebarMenuItem>
            <SidebarMenuButton
                asChild
                isActive={active}
                tooltip={label}
                className="h-8 text-[13px]"
            >
                <Link href={href} prefetch>
                    <WorkspaceAvatar
                        name={workspace.name}
                        type={workspace.type}
                        color={workspace.color}
                        ownerName={auth.user?.name}
                        className="size-4.5 text-[10px]"
                    />
                    <span className="truncate">{label}</span>
                </Link>
            </SidebarMenuButton>
            <SidebarMenuAction
                showOnHover={!workspace.favorite}
                aria-label={
                    workspace.favorite
                        ? `Hapus ${label} dari favorit`
                        : `Jadikan ${label} favorit`
                }
                onClick={() =>
                    router.visit(
                        (workspace.favorite ? unfavorite : favorite)(
                            workspace.key,
                        ),
                        { preserveScroll: true, preserveState: true },
                    )
                }
            >
                <Star
                    className={cn(
                        workspace.favorite
                            ? 'fill-current text-warning'
                            : 'text-text-subtle',
                    )}
                />
            </SidebarMenuAction>
        </SidebarMenuItem>
    );
}

/**
 * Sidebar "Workspace" section (mockup Main): the user's workspaces grouped
 * Pribadi · Divisi · Tim · Proyek, favorites first, collapsible (remembered
 * per browser). In the 56px rail only the avatars show, with tooltips.
 */
export function SidebarWorkspaces() {
    const workspaces = useSidebarWorkspaces();
    const [collapsed, setCollapsed] = useState(readCollapsed);
    const groups = groupByType(workspaces);
    const showGroupLabels = workspaces.length >= GROUP_LABELS_FROM;

    const toggle = (key: string, open: boolean) => {
        const next = { ...collapsed, [key]: !open };
        setCollapsed(next);
        writeCollapsed(next);
    };

    return (
        <Collapsible
            open={!collapsed.section}
            onOpenChange={(open) => toggle('section', open)}
            asChild
        >
            <SidebarGroup className="py-1">
                <SidebarGroupLabel
                    asChild
                    className="text-[11px] font-medium tracking-[.04em] text-text-muted uppercase"
                >
                    <CollapsibleTrigger className="group/trigger flex w-full items-center gap-1">
                        Workspace
                        <ChevronRight
                            aria-hidden
                            className="ml-auto size-3.5 transition-transform duration-120 ease-brand group-data-[state=open]/trigger:rotate-90"
                        />
                    </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent>
                    {groups.map((group) =>
                        showGroupLabels && group.type !== 'personal' ? (
                            <Collapsible
                                key={group.type}
                                open={!collapsed[group.type]}
                                onOpenChange={(open) =>
                                    toggle(group.type, open)
                                }
                            >
                                <CollapsibleTrigger className="group/sub flex h-6 w-full items-center gap-1 rounded-md px-2 text-[11px] text-text-subtle group-data-[collapsible=icon]:hidden hover:text-text-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                                    <ChevronRight
                                        aria-hidden
                                        className="size-3 transition-transform duration-120 ease-brand group-data-[state=open]/sub:rotate-90"
                                    />
                                    {TYPE_GROUP_LABELS[group.type]}
                                    <span className="ml-auto tnum">
                                        {group.items.length}
                                    </span>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <SidebarMenu>
                                        {group.items.map((workspace) => (
                                            <WorkspaceItem
                                                key={workspace.id}
                                                workspace={workspace}
                                            />
                                        ))}
                                    </SidebarMenu>
                                </CollapsibleContent>
                            </Collapsible>
                        ) : (
                            <SidebarMenu key={group.type}>
                                {group.items.map((workspace) => (
                                    <WorkspaceItem
                                        key={workspace.id}
                                        workspace={workspace}
                                    />
                                ))}
                            </SidebarMenu>
                        ),
                    )}
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton
                                asChild
                                tooltip="Semua workspace"
                                className="h-8 text-[13px] text-text-muted"
                            >
                                <Link href={index()} prefetch>
                                    <LayoutGrid
                                        className="size-4"
                                        strokeWidth={1.75}
                                    />
                                    <span>Semua workspace</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </CollapsibleContent>
            </SidebarGroup>
        </Collapsible>
    );
}
