import { usePage } from '@inertiajs/react';
import { LayoutGrid } from 'lucide-react';
import { ListRow } from '@/components/ui/list-row';
import { cn } from '@/lib/utils';
import { index } from '@/routes/workspaces';
import { groupWorkspaces } from './groups';
import { useSidebarWorkspaces, workspacePath } from './use-sidebar-workspaces';
import { WorkspaceAvatar } from './workspace-avatar';

const TILE = 'size-[38px] rounded-[11px] text-[16px] font-extrabold';

/**
 * Mobile Menu tab: workspace rows (design MMenu "Workspace") in one card,
 * a gradient letter tile per workspace (slate for the personal one), in the
 * groups Pribadi · Divisi & tim · Proyek yang diikuti (keputusan pemilik
 * 6 Okt 2026).
 */
export function MenuWorkspaceGrid() {
    const workspaces = useSidebarWorkspaces();
    const { auth } = usePage().props;

    return (
        <div className="divide-y divide-divider overflow-hidden rounded-[22px] border border-border bg-surface">
            {groupWorkspaces(workspaces).map(({ group, items }) => (
                <section
                    key={group.key}
                    aria-labelledby={`menu-ws-${group.key}`}
                    className="divide-y divide-divider"
                >
                    <h3
                        id={`menu-ws-${group.key}`}
                        className="flex items-center gap-2 px-4 pt-3 pb-2 text-[13px] font-bold tracking-[0.06em] text-text-muted uppercase"
                    >
                        <span
                            aria-hidden
                            className={cn('size-2 rounded-full', group.dot)}
                        />
                        {group.label}
                    </h3>
                    {items.length === 0 ? (
                        <p className="px-4 py-3 text-meta text-text-muted">
                            {group.empty}
                        </p>
                    ) : (
                        items.map((workspace) => (
                            <ListRow
                                key={workspace.id}
                                href={workspacePath(workspace.key)}
                                className="min-h-[60px] px-4 md:px-4"
                                leading={
                                    <WorkspaceAvatar
                                        name={workspace.name}
                                        type={workspace.type}
                                        color={workspace.color}
                                        ownerName={auth.user?.name}
                                        className={
                                            workspace.type === 'personal'
                                                ? `${TILE} bg-grad-slate text-on-brand ring-0`
                                                : TILE
                                        }
                                    />
                                }
                                title={
                                    workspace.type === 'personal'
                                        ? 'Pribadi'
                                        : workspace.name
                                }
                            />
                        ))
                    )}
                </section>
            ))}
            <ListRow
                href={index().url}
                className="min-h-[60px] px-4 md:px-4"
                leading={
                    <span className="flex size-[38px] items-center justify-center rounded-[11px] bg-surface-2 text-text">
                        <LayoutGrid className="size-5" aria-hidden />
                    </span>
                }
                title="Semua workspace"
            />
        </div>
    );
}
