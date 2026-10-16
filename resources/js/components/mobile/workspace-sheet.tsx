import { Link, usePage } from '@inertiajs/react';
import { ChevronRight, LayoutGrid } from 'lucide-react';
import { BottomSheet } from '@/components/mobile/bottom-sheet';
import { groupWorkspaces } from '@/features/workspaces/groups';
import {
    useSidebarWorkspaces,
    workspacePath,
} from '@/features/workspaces/use-sidebar-workspaces';
import { WorkspaceAvatar } from '@/features/workspaces/workspace-avatar';
import { index as workspacesIndex } from '@/routes/workspaces';
import { cn, focusRing } from '@/lib/utils';
import type { WorkspaceGroupKey } from '@/features/workspaces/groups';

/** Groups shown in the sheet (keputusan pemilik 9 Okt 2026): Tim = divisi & tim. */
const SHEET_GROUPS: Record<Exclude<WorkspaceGroupKey, 'lainnya'>, string> = {
    pribadi: 'Pribadi',
    divisi: 'Tim',
    proyek: 'Proyek',
};

const TILE = 'size-[38px] rounded-[11px] text-[16px] font-extrabold';

function Row({
    href,
    children,
    onNavigate,
}: {
    href: string;
    children: React.ReactNode;
    onNavigate: () => void;
}) {
    return (
        <Link
            href={href}
            prefetch
            onClick={onNavigate}
            className={cn(
                'flex min-h-11 items-center gap-3 rounded-control px-2 py-1 transition-colors duration-120 ease-brand hover:bg-surface-2 active:bg-surface-2',
                focusRing,
            )}
        >
            {children}
            <ChevronRight
                className="ml-auto size-5 shrink-0 text-text-subtle"
                aria-hidden
            />
        </Link>
    );
}

/**
 * Workspace picker of the tab bar's raised centre button (keputusan pemilik
 * 9 Okt 2026): the shell's already-loaded workspaces in the groups
 * Pribadi · Tim · Proyek; a tap opens /w/{key}. "Lainnya" (view-only
 * workspaces) stays on the Menu tab.
 */
export function WorkspaceSheet({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const workspaces = useSidebarWorkspaces();
    const { auth } = usePage().props;
    const close = () => onOpenChange(false);
    const sections = groupWorkspaces(workspaces).filter(
        (section) => section.group.key !== 'lainnya',
    );

    return (
        <BottomSheet
            open={open}
            onOpenChange={onOpenChange}
            title="Pilih workspace"
            description="Ruang kerja Anda, dikelompokkan asalnya."
        >
            <div className="flex flex-col gap-4 pb-3">
                {sections.map(({ group, items }) => (
                    <section
                        key={group.key}
                        aria-labelledby={`ws-sheet-${group.key}`}
                        className="flex flex-col gap-0.5"
                    >
                        <h3
                            id={`ws-sheet-${group.key}`}
                            className="flex items-center gap-2 px-2 pb-1 text-[13px] font-bold tracking-[0.06em] text-text-muted uppercase"
                        >
                            <span
                                aria-hidden
                                className={cn('size-2 rounded-full', group.dot)}
                            />
                            {
                                SHEET_GROUPS[
                                    group.key as Exclude<
                                        WorkspaceGroupKey,
                                        'lainnya'
                                    >
                                ]
                            }
                        </h3>
                        {items.length === 0 ? (
                            <p className="px-2 py-1 text-[15px] text-text-muted">
                                {group.empty}
                            </p>
                        ) : (
                            items.map((workspace) => (
                                <Row
                                    key={workspace.id}
                                    href={workspacePath(workspace.key)}
                                    onNavigate={close}
                                >
                                    <WorkspaceAvatar
                                        name={workspace.name}
                                        type={workspace.type}
                                        color={workspace.color}
                                        ownerName={auth.user?.name}
                                        tone="gradient"
                                        className={
                                            workspace.type === 'personal'
                                                ? `${TILE} bg-grad-slate text-on-brand ring-0`
                                                : TILE
                                        }
                                    />
                                    <span className="min-w-0 flex-1 truncate text-[17px] leading-6 font-semibold text-text">
                                        {workspace.type === 'personal'
                                            ? 'Pribadi'
                                            : workspace.name}
                                    </span>
                                </Row>
                            ))
                        )}
                    </section>
                ))}
                <div className="border-t border-border pt-3">
                    <Row href={workspacesIndex().url} onNavigate={close}>
                        <span className="flex size-[38px] shrink-0 items-center justify-center rounded-[11px] bg-surface-2 text-text">
                            <LayoutGrid className="size-5" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[17px] leading-6 font-semibold text-text">
                            Semua workspace
                        </span>
                    </Row>
                </div>
            </div>
        </BottomSheet>
    );
}
