import { usePage } from "@inertiajs/react";
import type { WorkspaceType } from "@/features/tasks/types";
import { palette, paletteGradient } from "@/lib/palette";
import { cn } from "@/lib/utils";
import { workspaceInitial } from "./lib";

type Props = {
  name: string;
  type: WorkspaceType;
  color: string | null;
  /** Owner name for personal workspaces; defaults to the signed-in user. */
  ownerName?: string | null;
  /**
   * `solid` (default): small palette square (sidebar, rows). `gradient`:
   * the Arus tile of the headers and cards (DProyek, SProyekSaya), the
   * palette colour mapped to a brand gradient.
   */
  tone?: "solid" | "gradient";
  className?: string;
};

/** Gradient tile of a workspace: personal = slate, else the palette gradient. */
export function workspaceGradient(type: WorkspaceType, color: string | null): string {
  return type === "personal" ? "bg-grad-slate" : paletteGradient(color);
}

/** Rounded square with the workspace initial (sidebar, headers, rows). */
export function WorkspaceAvatar({
  name,
  type,
  color,
  ownerName,
  tone = "solid",
  className,
}: Props) {
  const personal = type === "personal";
  const { auth } = usePage().props;

  return (
    <span
      aria-hidden
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-[5px] text-[11px] font-semibold",
        tone === "gradient"
          ? cn("bg-primary font-extrabold text-on-brand", workspaceGradient(type, color))
          : personal
            ? "bg-surface-2 text-text-muted ring-1 ring-border"
            : cn(palette(color).bg, "text-on-brand"),
        className,
      )}
    >
      {workspaceInitial(
        name,
        type,
        // Personal workspaces are only visible to their owner = the viewer.
        ownerName ?? auth.user?.name,
      )}
    </span>
  );
}
