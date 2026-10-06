import { usePage } from "@inertiajs/react";
import { LayoutGrid } from "lucide-react";
import { ListRow } from "@/components/ui/list-row";
import { index } from "@/routes/workspaces";
import { useSidebarWorkspaces, workspacePath } from "./use-sidebar-workspaces";
import { WorkspaceAvatar } from "./workspace-avatar";

const TILE = "size-[38px] rounded-[11px] text-[16px] font-extrabold";

/**
 * Mobile Menu tab: workspace rows (design MMenu "Workspace") in one card,
 * a gradient letter tile per workspace (slate for the personal one).
 */
export function MenuWorkspaceGrid() {
  const workspaces = useSidebarWorkspaces();
  const { auth } = usePage().props;

  return (
    <div className="divide-y divide-divider overflow-hidden rounded-[22px] border border-border bg-surface">
      {workspaces.map((workspace) => (
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
                workspace.type === "personal" ? `${TILE} bg-grad-slate text-on-brand ring-0` : TILE
              }
            />
          }
          title={workspace.type === "personal" ? "Pribadi" : workspace.name}
        />
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
