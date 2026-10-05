import { usePage } from '@inertiajs/react';
import { Archive, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Button } from '@/components/ui/button';
import { TabNav } from '@/components/ui/tabs';
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
    /** Toolbar right of the tabs (DBoard "Filter · Board/Daftar"). */
    tabsAside?: ReactNode;
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

/** "Dokumen 6", "File 24" (mockup WorkspaceFile); nothing when empty. */
function tabCount(
    tab: WorkspaceTab,
    counts: WorkspacePageProps['drive_counts'] | undefined,
): number | null {
    const value =
        tab === 'documents'
            ? counts?.documents
            : tab === 'files'
              ? counts?.files
              : undefined;

    return value ? value : null;
}

/**
 * Workspace header + tabs (DBoard / DProyek): 64px gradient tile, name in
 * the h1 scale, "KEY · Jenis · Visibilitas · N anggota", member avatars,
 * "Tugas baru" and the underlined `TabNav` (Ringkasan for projects ·) Tugas ·
 * Dokumen · File · Aktivitas · Pengaturan. `header` replaces the default
 * header (project summary), `tabsAside` sits right of the tabs (view
 * toolbar). On mobile the app bar carries the name: only the meta line and a
 * scrollable tab row.
 */
export function WorkspaceShell({
    workspace,
    members,
    drive_counts,
    tab,
    children,
    onCreateTask,
    header,
    tabsAside,
}: Props) {
    const breakpoint = useBreakpoint();
    const { auth } = usePage().props;
    const mobile = breakpoint === 'mobile';
    const title = workspace.type === 'personal' ? 'Pribadi' : workspace.name;
    const tabs = TABS.filter(
        (item) => item.tab !== 'summary' || workspace.type === 'project',
    ).map((item) => ({
        href: tabHref(item.tab, workspace.key),
        label: item.label,
        count: tabCount(item.tab, drive_counts) ?? undefined,
        active: item.tab === tab,
    }));

    return (
        <div className="flex flex-col gap-5 md:gap-6">
            {header ??
                (mobile ? (
                    <p className="-mt-1 flex items-center gap-2.5 text-meta text-text-muted">
                        <WorkspaceAvatar
                            name={workspace.name}
                            type={workspace.type}
                            color={workspace.color}
                            ownerName={auth.user?.name}
                            tone="gradient"
                            className="size-8 rounded-[10px] text-[14px]"
                        />
                        <span className="truncate">
                            {workspaceMeta(workspace)}
                        </span>
                    </p>
                ) : (
                    <header className="flex flex-wrap items-center justify-between gap-5">
                        <div className="flex min-w-0 items-center gap-[18px]">
                            <WorkspaceAvatar
                                name={workspace.name}
                                type={workspace.type}
                                color={workspace.color}
                                ownerName={auth.user?.name}
                                tone="gradient"
                                className="size-16 rounded-[18px] text-[26px] shadow-glow"
                            />
                            <div className="flex min-w-0 flex-col gap-1">
                                <h1 className="truncate text-h1 font-extrabold tracking-[-0.025em] text-text">
                                    {title}
                                </h1>
                                <p className="truncate text-[17px] text-text-muted">
                                    <span className="font-mono text-[15px] font-semibold">
                                        {workspace.key}
                                    </span>
                                    {workspaceMeta(workspace).slice(
                                        workspace.key.length,
                                    )}
                                </p>
                            </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-4">
                            {workspace.type !== 'personal' && (
                                <AvatarStack people={members} max={4} />
                            )}
                            {onCreateTask && (
                                <Button size="lg" onClick={onCreateTask}>
                                    <Plus strokeWidth={2.4} />
                                    Tugas baru
                                    <kbd className="rounded-xs bg-on-brand/18 px-1.5 font-mono text-[13px] font-semibold">
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
                    className="flex items-center gap-2.5 rounded-lg border border-border bg-surface-2 px-4 py-3 text-label font-medium text-text-muted"
                >
                    <Archive className="size-5" aria-hidden />
                    Workspace ini diarsipkan dan hanya bisa dibaca.
                </div>
            )}

            <div
                className={cn(
                    'flex flex-wrap items-end justify-between gap-x-4 border-b border-border',
                    mobile && '-mx-4 px-4',
                )}
            >
                <TabNav
                    label="Bagian workspace"
                    items={tabs}
                    preserveScroll
                    className={cn(
                        'min-w-0 border-b-0',
                        mobile
                            ? 'w-full gap-6 [&>a]:min-h-11'
                            : '[&>a]:text-[17px]',
                    )}
                />
                {tabsAside && (
                    <div className="flex flex-wrap items-center gap-2.5 pb-2.5">
                        {tabsAside}
                    </div>
                )}
            </div>

            {children}
        </div>
    );
}

/** Overlapping 38px member avatars with a "+N" bubble (DBoard header). */
function AvatarStack({
    people,
    max,
}: {
    people: WorkspacePageProps['members'];
    max: number;
}) {
    const shown = people.slice(0, max);
    const rest = people.length - shown.length;

    return (
        <span
            className="flex items-center -space-x-2"
            title={people.map((person) => person.name).join(', ')}
        >
            {shown.map((person) => (
                <UserAvatar
                    key={person.id}
                    name={person.name}
                    src={person.avatar}
                    className="size-[38px] text-[14px] ring-[3px] ring-background"
                />
            ))}
            {rest > 0 && (
                <span className="flex size-[38px] items-center justify-center rounded-full bg-avatar-neutral text-[14px] font-bold text-avatar-neutral-fg ring-[3px] ring-background">
                    +{rest}
                </span>
            )}
            <span className="sr-only">
                Anggota: {people.map((person) => person.name).join(', ')}
            </span>
        </span>
    );
}
