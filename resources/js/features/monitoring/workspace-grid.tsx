import { Link } from '@inertiajs/react';
import { Eye, Search, SearchX } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { ChipScroller } from '@/components/mobile/chip-scroller';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Panel } from '@/components/ui/panel';
import { WorkspaceAvatar } from '@/features/workspaces/workspace-avatar';
import { cn, focusRing } from '@/lib/utils';
import { filterWorkspaces } from './lib';
import type { WorkspaceFilter } from './lib';
import type { DirectoryWorkspace } from './types';

const CHIPS: { value: WorkspaceFilter; label: string }[] = [
    { value: 'all', label: 'Semua' },
    { value: 'project', label: 'Proyek' },
    { value: 'division', label: 'Divisi' },
    { value: 'team', label: 'Tim' },
];

/**
 * Akses cepat workspace (keputusan pemilik 6 Okt 2026): every team, division
 * and project workspace — Direksi, HR and Super Admin open them directly.
 * "Lihat saja" marks the ones they are not a member of (read-only).
 */
export function WorkspaceGrid({
    workspaces,
    compact = false,
    className,
}: {
    workspaces: DirectoryWorkspace[];
    compact?: boolean;
    className?: string;
}) {
    const [type, setType] = useState<WorkspaceFilter>('all');
    const [query, setQuery] = useState('');
    const shown = filterWorkspaces(workspaces, type, query);

    return (
        <Panel
            title={
                <>
                    Akses cepat workspace
                    <Badge variant="status" tone="neutral" className="h-7">
                        {workspaces.length}
                    </Badge>
                </>
            }
            className={cn(compact && 'py-5', className)}
            bodyClassName="gap-4"
        >
            <div className="flex flex-wrap items-center gap-3">
                <label
                    className={cn(
                        'relative block',
                        compact ? 'w-full' : 'w-72',
                    )}
                >
                    <span className="sr-only">Cari workspace</span>
                    <Search
                        aria-hidden
                        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-text-subtle"
                    />
                    <Input
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Cari nama atau kode"
                        className="pl-10"
                    />
                </label>
                <ChipScroller<WorkspaceFilter>
                    label="Jenis workspace"
                    value={type}
                    onChange={setType}
                    chips={CHIPS.map((chip) => ({
                        ...chip,
                        count: filterWorkspaces(workspaces, chip.value, '')
                            .length,
                    }))}
                    className={cn(
                        compact ? 'w-full' : 'mx-0 min-w-0 flex-1 px-0',
                    )}
                />
            </div>
            {shown.length === 0 ? (
                <EmptyState
                    size="sm"
                    icon={SearchX}
                    title="Tidak ada workspace yang cocok"
                >
                    Ubah jenis atau kata pencarian.
                </EmptyState>
            ) : (
                <ul
                    className={cn(
                        'grid gap-3',
                        compact
                            ? 'grid-cols-1'
                            : 'sm:grid-cols-2 xl:grid-cols-3',
                    )}
                >
                    {shown.map((workspace) => (
                        <li key={workspace.id}>
                            <Link
                                href={workspace.url}
                                className={cn(
                                    'flex h-full min-h-[72px] items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 transition-[border-color,transform] duration-120 ease-brand hover:-translate-y-px hover:border-border-strong motion-reduce:hover:translate-y-0',
                                    focusRing,
                                )}
                            >
                                <WorkspaceAvatar
                                    name={workspace.name}
                                    type={workspace.type}
                                    color={workspace.color}
                                    tone="gradient"
                                    className="size-11 rounded-[12px] text-[17px]"
                                />
                                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                    <span className="truncate text-[16px] font-semibold">
                                        {workspace.name}
                                    </span>
                                    <span className="truncate text-meta text-text-muted">
                                        <span className="font-mono">
                                            {workspace.key}
                                        </span>{' '}
                                        · {workspace.type_label} ·{' '}
                                        {workspace.members_count} anggota ·{' '}
                                        {workspace.open_tasks_count} tugas
                                        terbuka
                                    </span>
                                </span>
                                {workspace.view_only && (
                                    <Badge
                                        variant="label"
                                        tone="info"
                                        className="h-7 shrink-0 gap-1 px-2 text-[13px]"
                                    >
                                        <Eye className="size-3.5" aria-hidden />
                                        Lihat saja
                                    </Badge>
                                )}
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </Panel>
    );
}
