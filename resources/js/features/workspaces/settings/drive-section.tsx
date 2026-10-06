import { router } from "@inertiajs/react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DriveAccessBadge } from "@/features/drive/drive-access-badge";
import type { DriveAccessSummary } from "@/features/drive/types";
import { sync } from "@/routes/workspaces/drive";
import type { WorkspaceDetail } from "../types";
import { SettingsCard } from "./settings-card";

export type WorkspaceDriveSettings = {
  enabled: boolean;
  folder_url: string | null;
  folder_name: string;
  access: DriveAccessSummary;
};

type Props = {
  workspace: WorkspaceDetail;
  drive: WorkspaceDriveSettings;
  editable: boolean;
};

/**
 * Pengaturan › Integrasi Drive: workspace folder, access summary and
 * "Sinkronkan ulang" (queues folder creation / permission sync).
 */
export function DriveSection({ workspace, drive, editable }: Props) {
  const [processing, setProcessing] = useState(false);

  return (
    <SettingsCard
      id="integrasi-drive"
      title="Integrasi Drive"
      description="Folder Google Shared Drive milik workspace ini. Izin folder mengikuti daftar anggota: owner, admin, dan member dapat mengedit; viewer hanya melihat."
    >
      <div className="flex flex-wrap items-center gap-3 px-5 pb-6 md:px-7">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-label text-text">{drive.folder_name}</p>
          <DriveAccessBadge access={drive.access} />
        </div>
        {drive.folder_url && (
          <Button asChild variant="outline" size="sm">
            <a href={drive.folder_url} target="_blank" rel="noopener noreferrer">
              Buka di Drive
              <ExternalLink />
            </a>
          </Button>
        )}
        {editable && drive.enabled && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={processing}
            onClick={() =>
              router.post(
                sync.url(workspace.key),
                {},
                {
                  preserveScroll: true,
                  onStart: () => setProcessing(true),
                  onFinish: () => setProcessing(false),
                },
              )
            }
          >
            <RefreshCw className={processing ? "animate-spin" : undefined} />
            Sinkronkan ulang
          </Button>
        )}
      </div>
    </SettingsCard>
  );
}
