import { Link, usePage } from '@inertiajs/react';
import { Archive, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AvatarStack } from '@/features/tasks/avatar-stack';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { cn } from '@/lib/utils';
import { summary } from '@/routes/projects';
import {
    activity,
    documents,
    files,
    settings,
    show,
} from '@/routes/workspaces';
import { workspaceMeta } from './lib';
import type { WorkspacePageProps, WorkspaceTab } from './types';
import { WorkspaceAvatar } from './workspace-avatar';

type Props = WorkspacePageProps & {
    tab: WorkspaceTab;
    children: ReactNode;
    /** "Tugas baru" in the header (desktop); hidden when null. */
    onCreateTask?: (() => void) | null;
    /** Replaces the default header (project summary, Sprint 9). */
    header?: ReactNode;
};

const TABS: { tab: WorkspaceTab; label: string }[] = [
    { tab: 'summary', label: 'Ringkasan' },
    { tab: 'tasks', label: 'Tugas' },
    { tab: 'documents', label: 'Dokumen' },
    { tab: 'files', label: 'File' },
    { tab: 'activity', label: 'Aktivitas' },
    { tab: 'settings', label: 'Pengaturan' },
];

function tabHref(tab: WorkspaceTab, key: string): string {
    switch (tab) {
        case 'documents':
            return documents.url(key);
        case 'files':
            return files.url(key);
        case 'activity':
            return activity.url(key);
        case 'settings':
            return settings.url(key);
        case 'summary':
            return summary.url(key);
        default:
            return show.url(key);
    }
}

/**
 * Workspace header + tabs (mockup Kanban / WorkspacePengaturan): avatar,
 * name, "KEY · Jenis · Visibilitas · N anggota", member avatars, "Tugas baru"
 * and the tabs (Ringkasan for projects ·) Tugas · Dokumen · File · Aktivitas ·
 * Pengaturan. `header` replaces the default header (project summary). On mobile a
 * compact header and a scrollable tab row.
 */
export function WorkspaceShell({
    workspace,
    members,
    tab,
    children,
    onCreateTask,
    header,
}: Props) {
    const breakpoint = useBreakpoint();
    const { auth } = usePage().props;
    const mobile = breakpoint === 'mobile';
    const title = workspace.type === 'personal' ? 'Pribadi' : workspace.name;

    return (
        <div className="space-y-4">
            {header ??
                (mobile ? (
                    // The app bar already shows the name (mockup MBoard): only the meta line here.
                    <p className="-mt-2 flex items-center gap-2 text-[13px] text-text-muted">
                        <WorkspaceAvatar
                            name={workspace.name}
                            type={workspace.type}
                            color={workspace.color}
                            ownerName={auth.user?.name}
                        />
                        <span className="truncate">
                            {workspaceMeta(workspace)}
                        </span>
                    </p>
                ) : (
                    <header className="flex items-start gap-3">
                        <WorkspaceAvatar
                            name={workspace.name}
                            type={workspace.type}
                            color={workspace.color}
                            ownerName={auth.user?.name}
                            className="size-8 rounded-md text-sm"
                        />
                        <div className="min-w-0 flex-1">
                            <h1 className="truncate text-xl leading-7 font-semibold text-text">
                                {title}
                            </h1>
                            <p className="truncate text-[13px] text-text-muted">
                                {workspaceMeta(workspace)}
                            </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                            {workspace.type !== 'personal' && (
                                <AvatarStack
                                    people={members}
                                    max={4}
                                    size="md"
                                />
                            )}
                            {onCreateTask && (
                                <Button
                                    size="sm"
                                    className="h-8"
                                    onClick={onCreateTask}
                                >
                                    <Plus />
                                    Tugas baru
                                    <kbd className="rounded border border-primary-foreground/30 px-1 font-mono text-[10px]">
                                        C
                                    </kbd>
                                </Button>
                            )}
                        </div>
                    </header>
                ))}

            {workspace.archived && (
                <div
                    role="status"
                    className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2 text-[13px] text-text-muted"
                >
                    <Archive className="size-4" aria-hidden />
                    Workspace ini diarsipkan dan hanya bisa dibaca.
                </div>
            )}

            <nav
                aria-label="Bagian workspace"
                className={cn(
                    'flex gap-1 border-b border-border',
                    mobile &&
                        '-mx-4 [scrollbar-width:none] overflow-x-auto px-4 [&::-webkit-scrollbar]:hidden',
                )}
            >
                {TABS.filter(
                    (item) =>
                        item.tab !== 'summary' || workspace.type === 'project',
                ).map((item) => {
                    const active = item.tab === tab;

                    return (
                        <Link
                            key={item.tab}
                            href={tabHref(item.tab, workspace.key)}
                            prefetch
                            preserveScroll
                            aria-current={active ? 'page' : undefined}
                            className={cn(
                                '-mb-px flex shrink-0 items-center border-b-2 px-2.5 font-medium transition-colors duration-120 ease-brand focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                                mobile ? 'h-11 text-[15px]' : 'h-9 text-[13px]',
                                active
                                    ? 'border-primary text-text'
                                    : 'border-transparent text-text-muted hover:text-text',
                            )}
                        >
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            {children}
        </div>
    );
}
