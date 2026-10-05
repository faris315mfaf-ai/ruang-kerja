import { Head } from '@inertiajs/react';
import { FileText } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { workspaceLayout } from '@/features/workspaces/tab-layout';
import type { WorkspacePageProps } from '@/features/workspaces/types';
import { WorkspaceShell } from '@/features/workspaces/workspace-shell';

/** Tab Dokumen — Google Docs/Sheets/Slides arrive with the Drive integration (Sprint 7). */
export default function WorkspaceDocuments(props: WorkspacePageProps) {
    return (
        <>
            <Head title={`${props.workspace.name} · Dokumen`} />
            <WorkspaceShell {...props} tab="documents">
                <EmptyState
                    icon={FileText}
                    title="Dokumen segera tersedia"
                    description="Google Docs, Sheets, dan Slides milik workspace ini akan tampil di sini setelah integrasi Google Drive aktif."
                />
            </WorkspaceShell>
        </>
    );
}

WorkspaceDocuments.layout = (props: WorkspacePageProps) =>
    workspaceLayout(props, 'Dokumen');
