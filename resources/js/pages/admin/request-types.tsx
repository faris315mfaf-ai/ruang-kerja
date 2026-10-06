import { Head, router } from '@inertiajs/react';
import { GitBranch, MoreHorizontal, Plus } from 'lucide-react';
import { useCallback, useState } from 'react';
import { DesktopOnlyNotice } from '@/components/desktop-only-notice';
import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AdminPageHeader } from '@/features/admin/page-header';
import { FlowEditor } from '@/features/admin-requests/flow-editor';
import { flowSummary } from '@/features/admin-requests/flow-summary';
import { LeaveTypeDialog } from '@/features/admin-requests/leave-type-dialog';
import type {
    AdminLeaveType,
    AdminRequestTypesProps,
} from '@/features/admin-requests/types';
import { ConfirmDialog } from '@/features/requests/confirm-dialog';
import { ProvisionalBadge } from '@/features/requests/form-fields';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { formatDays } from '@/lib/requests';
import { cn, focusRing } from '@/lib/utils';
import { destroy as destroyType } from '@/routes/admin/leave-types';
import { index } from '@/routes/admin/request-types';

export default function RequestTypes({
    types,
    flows,
    selected,
    options,
}: AdminRequestTypesProps) {
    const breakpoint = useBreakpoint();
    const [selectedId, setSelectedId] = useState(
        selected ?? types[0]?.id ?? null,
    );
    const [dirty, setDirty] = useState(false);
    const [dialog, setDialog] = useState<{
        type: AdminLeaveType | null;
    } | null>(null);
    const [deleting, setDeleting] = useState<AdminLeaveType | null>(null);
    const onDirtyChange = useCallback((value: boolean) => setDirty(value), []);

    if (breakpoint === 'mobile') {
        return (
            <>
                <Head title="Jenis pengajuan & alur persetujuan" />
                <DesktopOnlyNotice feature="Jenis pengajuan & alur persetujuan" />
            </>
        );
    }

    const type = types.find((t) => t.id === selectedId) ?? types[0];
    const defaultFlow = flows.find((flow) => flow.is_default);
    const flowOf = (t: AdminLeaveType) =>
        flows.find((flow) => flow.id === t.approval_flow_id) ?? defaultFlow;

    const choose = (id: string) => {
        if (
            dirty &&
            !window.confirm('Perubahan alur belum disimpan. Tinggalkan?')
        ) {
            return;
        }

        setSelectedId(id);
    };

    return (
        <>
            <Head title="Jenis pengajuan & alur persetujuan" />
            <div className="flex flex-col gap-6">
                <AdminPageHeader
                    overline="Admin · Pengajuan"
                    title="Jenis pengajuan & alur persetujuan"
                    description="Atur siapa yang menyetujui setiap jenis pengajuan, dan dalam urutan apa."
                    actions={
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setDialog({ type: null })}
                        >
                            <Plus aria-hidden /> Jenis baru
                        </Button>
                    }
                />

                <div className="grid items-start gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
                    <nav
                        aria-label="Jenis pengajuan"
                        className="overflow-hidden rounded-panel border border-border bg-surface pt-5 pb-2 shadow-card"
                    >
                        <p className="flex items-baseline justify-between px-5 pb-3 text-h3">
                            Jenis
                            <span className="text-meta font-semibold text-text-muted tnum">
                                {types.length}
                            </span>
                        </p>
                        <ul className="border-t border-divider">
                            {types.map((item) => {
                                const active = item.id === type?.id;

                                return (
                                    <li
                                        key={item.id}
                                        className="border-b border-divider last:border-0"
                                    >
                                        <button
                                            type="button"
                                            aria-current={
                                                active ? 'true' : undefined
                                            }
                                            onClick={() => choose(item.id)}
                                            className={cn(
                                                'flex min-h-[72px] w-full flex-col justify-center gap-0.5 px-5 py-3 text-left transition-colors duration-120 ease-brand hover:bg-background',
                                                focusRing,
                                                'focus-visible:ring-inset',
                                                active &&
                                                    'bg-link-soft shadow-[inset_3px_0_0_var(--primary)] hover:bg-link-soft',
                                            )}
                                        >
                                            <span className="flex items-center justify-between gap-2">
                                                <span className="flex min-w-0 flex-wrap items-center gap-2 text-[16px] font-semibold">
                                                    {item.name}
                                                    {active && dirty && (
                                                        <Badge
                                                            variant="status"
                                                            tone="warning"
                                                            className="h-6 px-2 text-[13px]"
                                                        >
                                                            Belum disimpan
                                                        </Badge>
                                                    )}
                                                    {item.is_provisional_default && (
                                                        <ProvisionalBadge />
                                                    )}
                                                    {item.locked_reason !==
                                                        null && (
                                                        <Badge
                                                            variant="status"
                                                            tone="warning"
                                                            className="h-6 px-2 text-[13px]"
                                                            title={
                                                                item.locked_reason
                                                            }
                                                        >
                                                            Dikunci
                                                        </Badge>
                                                    )}
                                                    {!item.is_active && (
                                                        <Badge
                                                            variant="status"
                                                            tone="neutral"
                                                            className="h-6 px-2 text-[13px]"
                                                        >
                                                            Nonaktif
                                                        </Badge>
                                                    )}
                                                </span>
                                                <span className="font-mono text-[13px] font-semibold text-text-muted">
                                                    {item.code}
                                                </span>
                                            </span>
                                            <span className="block truncate text-meta text-text-muted">
                                                {item.annual_quota_days !== null
                                                    ? `${formatDays(item.annual_quota_days)} hari/tahun · `
                                                    : ''}
                                                {flowSummary(
                                                    flowOf(item),
                                                    options,
                                                )}
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </nav>

                    {type ? (
                        <div className="relative min-w-0">
                            <div className="absolute top-5 right-5 z-10">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            aria-label="Aksi jenis"
                                        >
                                            <MoreHorizontal aria-hidden />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem
                                            onSelect={() => setDialog({ type })}
                                        >
                                            Ubah jenis
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            className="text-danger"
                                            onSelect={() => setDeleting(type)}
                                        >
                                            Hapus jenis
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                            <FlowEditor
                                key={`${type.id}-${flowOf(type)?.updated_at ?? ''}`}
                                type={type}
                                flow={flowOf(type)}
                                types={types}
                                options={options}
                                onDirtyChange={onDirtyChange}
                            />
                        </div>
                    ) : (
                        <EmptyState
                            icon={GitBranch}
                            title="Belum ada jenis pengajuan"
                            description="Buat jenis baru untuk mengatur alur persetujuannya."
                        />
                    )}
                </div>
            </div>

            {dialog && (
                <LeaveTypeDialog
                    key={dialog.type?.id ?? 'new'}
                    open
                    onOpenChange={(open) => !open && setDialog(null)}
                    type={dialog.type}
                    flows={flows}
                    options={options}
                />
            )}

            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
                title={`Hapus ${deleting?.name ?? ''}?`}
                description="Jenis tidak bisa dipilih lagi. Pengajuan lama tetap tersimpan beserta nomornya."
                confirmLabel="Hapus"
                destructive
                onConfirm={() =>
                    deleting &&
                    router.delete(destroyType.url({ leaveType: deleting.id }), {
                        onFinish: () => setDeleting(null),
                    })
                }
            />
        </>
    );
}

RequestTypes.layout = {
    width: 'wide',
    breadcrumbs: [
        { title: 'Admin', href: '' },
        { title: 'Jenis pengajuan & alur persetujuan', href: index() },
    ],
    title: 'Jenis pengajuan',
    back: '/menu',
};
