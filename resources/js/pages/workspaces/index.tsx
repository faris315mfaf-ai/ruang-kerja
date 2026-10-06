import { Head, Link, router, usePage } from '@inertiajs/react';
import { Plus, Users } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HiringWorkspaceCard } from '@/features/hiring/hiring-workspace-card';
import type { HiringOverview } from '@/features/hiring/types';
import type { WorkspaceRole } from '@/features/tasks/types';
import {
    CreateWorkspaceDialog,
    type CreateAbilities,
} from '@/features/workspaces/create-workspace-dialog';
import {
    groupCounts,
    groupWorkspaces,
    parseWorkspaceFilter,
} from '@/features/workspaces/groups';
import type {
    WorkspaceFilter,
    WorkspaceGroupKey,
} from '@/features/workspaces/groups';
import type { WorkspaceDetail } from '@/features/workspaces/types';
import { WorkspaceGroupChips } from '@/features/workspaces/workspace-group-chips';
import { ROLE_LABELS } from '@/features/workspaces/types';
import { WorkspaceAvatar } from '@/features/workspaces/workspace-avatar';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { formatNumber } from '@/lib/format';
import { cn, focusRing } from '@/lib/utils';
import { index, show } from '@/routes/workspaces';

type Row = WorkspaceDetail & {
    open_tasks_count: number;
    is_member: boolean;
    my_role: WorkspaceRole | null;
    group: WorkspaceGroupKey;
};

type Props = {
    workspaces: Row[];
    /** `?jenis=` chip (null = Semua). */
    filter: WorkspaceGroupKey | null;
    can_create: CreateAbilities;
    teams: { id: string; name: string }[];
    /** The Hiring space card; null without access (docs/fitur/hiring.md). */
    hiring?: HiringOverview | null;
};

/** "Proyek · 9 anggota" · "Pribadi · Hanya Anda". */
function typeLine(workspace: Row): string {
    if (workspace.type === 'personal') {
        return 'Pribadi · Hanya Anda';
    }

    return `${workspace.type_label} · ${formatNumber(workspace.members_count)} anggota`;
}

function RolePill({ workspace }: { workspace: Row }) {
    if (!workspace.is_member || workspace.my_role === null) {
        return (
            <Badge variant="status" className="h-7 px-2.5 text-[14px]">
                Bukan anggota
            </Badge>
        );
    }

    if (workspace.my_role === 'owner') {
        return (
            <Badge className="h-7 px-2.5">
                {workspace.type === 'personal' ? 'Pemilik' : ROLE_LABELS.owner}
            </Badge>
        );
    }

    return (
        <Badge variant="status" className="h-7 px-2.5 text-[14px]">
            {ROLE_LABELS[workspace.my_role]}
        </Badge>
    );
}

/** Workspace card (SProyekSaya / MSProyekSaya). */
function WorkspaceCard({ workspace }: { workspace: Row }) {
    const { auth } = usePage().props;
    const name = workspace.type === 'personal' ? 'Pribadi' : workspace.name;

    return (
        <Link
            href={show.url(workspace.key)}
            prefetch
            className={cn(
                'flex h-full flex-col gap-3.5 rounded-panel border border-border bg-surface p-[18px] text-text shadow-card transition-[border-color,box-shadow] duration-120 ease-brand hover:border-border-strong md:p-[22px]',
                focusRing,
            )}
        >
            <span className="flex items-center gap-3">
                <WorkspaceAvatar
                    name={workspace.name}
                    type={workspace.type}
                    color={workspace.color}
                    ownerName={auth.user?.name}
                    tone="gradient"
                    className="size-12 rounded-[14px] text-[19px]"
                />
                <span className="flex min-w-0 flex-1 flex-col">
                    <span className="line-clamp-2 text-title font-bold">
                        {name}
                    </span>
                    <span className="truncate text-meta text-text-muted">
                        {typeLine(workspace)}
                    </span>
                </span>
            </span>
            <span className="flex flex-wrap items-center gap-2">
                <RolePill workspace={workspace} />
                {workspace.archived && (
                    <Badge variant="label" className="h-7">
                        Diarsipkan
                    </Badge>
                )}
            </span>
            {workspace.description && (
                <span className="line-clamp-2 text-label font-normal text-text-muted">
                    {workspace.description}
                </span>
            )}
            <span className="mt-auto flex items-center justify-between gap-3 border-t border-divider pt-2.5 text-label font-normal text-text-muted">
                <span>
                    Tugas aktif{' '}
                    <b className="text-text tnum">
                        {formatNumber(workspace.open_tasks_count)}
                    </b>
                </span>
                <span className="truncate">
                    <span className="font-mono text-[14px] font-semibold">
                        {workspace.key}
                    </span>{' '}
                    ·{' '}
                    {workspace.visibility === 'internal'
                        ? 'Internal'
                        : 'Private'}
                </span>
            </span>
        </Link>
    );
}

/**
 * /workspace (SProyekSaya / MSProyekSaya): every workspace the user can see
 * as cards in titled groups Pribadi · Divisi & tim · Proyek yang diikuti
 * (· Lainnya), with filter chips kept in `?jenis=` (keputusan pemilik
 * 6 Okt 2026).
 */
export default function WorkspaceIndex({
    workspaces,
    filter: initialFilter,
    can_create,
    teams,
    hiring,
}: Props) {
    const [creating, setCreating] = useState(false);
    const [filter, setFilter] = useState<WorkspaceFilter>(
        parseWorkspaceFilter(initialFilter),
    );
    const counts = groupCounts(workspaces);
    const sections = groupWorkspaces(workspaces, filter);
    const changeFilter = (next: WorkspaceFilter) => {
        setFilter(next);
        router.get(
            index.url({ query: next === 'semua' ? {} : { jenis: next } }),
            {},
            {
                only: ['filter'],
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    };
    const mobile = useBreakpoint() === 'mobile';
    const canCreate = can_create.team || can_create.project;
    const projects = workspaces.filter(
        (workspace) => workspace.type === 'project',
    ).length;
    const openTasks = workspaces.reduce(
        (sum, workspace) => sum + workspace.open_tasks_count,
        0,
    );

    return (
        <>
            <Head title="Workspace" />
            <div className="flex flex-col gap-5 md:gap-6">
                <header className="flex flex-wrap items-end justify-between gap-4">
                    <div className="flex flex-col gap-1 md:gap-2">
                        {/* The phone app bar already shows "Workspace". */}
                        <h1 className="sr-only text-display md:not-sr-only">
                            Workspace &amp; proyek saya
                        </h1>
                        <p className="text-body text-text-muted md:text-body-lg">
                            {formatNumber(workspaces.length)} workspace ·{' '}
                            {formatNumber(projects)} proyek ·{' '}
                            {formatNumber(openTasks)} tugas aktif
                        </p>
                    </div>
                    {canCreate && (
                        <Button
                            className={cn(mobile && 'w-full')}
                            size={mobile ? 'lg' : 'default'}
                            onClick={() => setCreating(true)}
                        >
                            <Plus strokeWidth={2.4} />
                            Workspace baru
                        </Button>
                    )}
                </header>

                {workspaces.length === 0 && !hiring ? (
                    <EmptyState
                        icon={Users}
                        title="Belum ada workspace"
                        description="Workspace pribadi Anda akan muncul di sini."
                    />
                ) : (
                    <>
                        {hiring && (
                            <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))] gap-3 md:gap-4">
                                <li className="min-w-0">
                                    <HiringWorkspaceCard overview={hiring} />
                                </li>
                            </ul>
                        )}
                        <WorkspaceGroupChips
                            value={filter}
                            counts={counts}
                            onChange={changeFilter}
                            withOther={counts.lainnya > 0}
                        />
                        {sections.map(({ group, items }) => (
                            <section
                                key={group.key}
                                aria-labelledby={`ws-group-${group.key}`}
                                className="flex flex-col gap-3"
                            >
                                <h2
                                    id={`ws-group-${group.key}`}
                                    className="flex items-center gap-2 text-overline text-text-muted"
                                >
                                    <span
                                        aria-hidden
                                        className={cn(
                                            'size-2.5 rounded-full',
                                            group.dot,
                                        )}
                                    />
                                    {group.label}
                                    <span className="tnum">
                                        {formatNumber(items.length)}
                                    </span>
                                </h2>
                                {items.length === 0 ? (
                                    <EmptyState
                                        size="sm"
                                        icon={Users}
                                        title={group.empty}
                                    />
                                ) : (
                                    <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))] gap-3 md:gap-4">
                                        {items.map((workspace) => (
                                            <li
                                                key={workspace.id}
                                                className="min-w-0"
                                            >
                                                <WorkspaceCard
                                                    workspace={workspace}
                                                />
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </section>
                        ))}
                    </>
                )}
            </div>
            {canCreate && (
                <CreateWorkspaceDialog
                    open={creating}
                    onOpenChange={setCreating}
                    can={can_create}
                    teams={teams}
                />
            )}
        </>
    );
}

WorkspaceIndex.layout = {
    breadcrumbs: [{ title: 'Workspace', href: '/workspace' }],
};
