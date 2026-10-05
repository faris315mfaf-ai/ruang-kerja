import { router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { archive, restore } from '@/routes/workspaces';
import type { WorkspaceDetail } from '../types';
import { SettingsCard } from './settings-card';

/** Pengaturan › Zona bahaya: archive / restore (owner or Super Admin). */
export function DangerSection({ workspace }: { workspace: WorkspaceDetail }) {
    return (
        <SettingsCard id="zona-bahaya" title="Zona bahaya" tone="danger">
            <div className="flex flex-wrap items-center gap-4 px-5 pb-6 md:px-7">
                <div className="min-w-0 flex-1">
                    <p className="text-label text-text">
                        {workspace.archived
                            ? 'Pulihkan workspace'
                            : 'Arsipkan workspace'}
                    </p>
                    <p className="text-[15px] text-text-muted">
                        {workspace.archived
                            ? 'Workspace kembali bisa diedit dan tugasnya muncul lagi di Tugas saya.'
                            : 'Workspace menjadi baca-saja, tugasnya tidak muncul di Tugas saya, dan hilang dari sidebar. Owner dapat memulihkannya kapan saja.'}
                    </p>
                </div>
                {workspace.archived ? (
                    <Button
                        variant="outline"
                        onClick={() =>
                            router.delete(restore.url(workspace.key), {
                                preserveScroll: true,
                            })
                        }
                    >
                        Pulihkan workspace
                    </Button>
                ) : (
                    <Button
                        variant="outline"
                        className="border-danger/50 text-danger hover:bg-danger-soft hover:text-danger"
                        onClick={() => {
                            if (window.confirm(`Arsipkan ${workspace.name}?`)) {
                                router.post(
                                    archive.url(workspace.key),
                                    {},
                                    { preserveScroll: true },
                                );
                            }
                        }}
                    >
                        Arsipkan workspace
                    </Button>
                )}
            </div>
        </SettingsCard>
    );
}
