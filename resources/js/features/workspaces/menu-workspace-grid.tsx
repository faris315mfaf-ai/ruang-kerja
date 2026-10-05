import { Link, usePage } from '@inertiajs/react';
import { LayoutGrid } from 'lucide-react';
import { index } from '@/routes/workspaces';
import { useSidebarWorkspaces, workspacePath } from './use-sidebar-workspaces';
import { WorkspaceAvatar } from './workspace-avatar';

const tile =
    'flex min-h-14 items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 transition-colors duration-120 ease-brand hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

/** Mobile Menu tab: workspace grid (mockup MMenu), two per row. */
export function MenuWorkspaceGrid() {
    const workspaces = useSidebarWorkspaces();
    const { auth } = usePage().props;

    return (
        <div className="grid grid-cols-2 gap-2.5">
            {workspaces.map((workspace) => (
                <Link
                    key={workspace.id}
                    href={workspacePath(workspace.key)}
                    prefetch
                    className={tile}
                >
                    <WorkspaceAvatar
                        name={workspace.name}
                        type={workspace.type}
                        color={workspace.color}
                        ownerName={auth.user?.name}
                        className="size-8 rounded-md text-sm"
                    />
                    <span className="line-clamp-2 text-[15px] leading-5 text-text">
                        {workspace.type === 'personal'
                            ? 'Pribadi'
                            : workspace.name}
                    </span>
                </Link>
            ))}
            <Link href={index()} prefetch className={tile}>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-2 text-text-muted ring-1 ring-border">
                    <LayoutGrid
                        className="size-4"
                        strokeWidth={1.75}
                        aria-hidden
                    />
                </span>
                <span className="text-[15px] text-text-muted">
                    Semua workspace
                </span>
            </Link>
        </div>
    );
}
