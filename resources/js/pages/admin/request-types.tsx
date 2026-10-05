import { Head, router } from '@inertiajs/react';
import { MoreHorizontal, Plus } from 'lucide-react';
import { useCallback, useState } from 'react';
import { DesktopOnlyNotice } from '@/components/desktop-only-notice';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FlowEditor } from '@/features/admin-requests/flow-editor';
import { flowSummary } from '@/features/admin-requests/flow-summary';
import { LeaveTypeDialog } from '@/features/admin-requests/leave-type-dialog';
import type {
    AdminLeaveType,
    AdminRequestTypesProps,
} from '@/features/admin-requests/types';
import { ConfirmDialog } from '@/features/requests/confirm-dialog';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { formatDays } from '@/lib/requests';
import { cn } from '@/lib/utils';
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
                <Head title="Jenis pengajuan & alur" />
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
            <Head title="Jenis pengajuan & alur" />
            <div className="mx-auto max-w-[1200px] space-y-6">
                <header className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-xl leading-7 font-semibold text-text">
                            Jenis pengajuan & alur persetujuan
                        </h1>
                        <p className="text-sm text-text-muted">
                            Atur siapa yang menyetujui setiap jenis pengajuan,
                            dan dalam urutan apa.
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setDialog({ type: null })}
                    >
                        <Plus aria-hidden /> Jenis baru
                    </Button>
                </header>

                <div className="grid items-start gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
                    <nav
                        aria-label="Jenis pengajuan"
                        className="overflow-hidden rounded-xl border border-border bg-surface shadow-card"
                    >
                        <p className="flex justify-between border-b border-border bg-surface-2/60 px-4 py-2.5 text-[13px] text-text-muted">
                            Jenis <span className="tnum">{types.length}</span>
                        </p>
                        <ul>
                            {types.map((item) => {
                                const active = item.id === type?.id;

                                return (
                                    <li
                                        key={item.id}
                                        className="border-b border-border last:border-0"
                                    >
                                        <button
                                            type="button"
                                            aria-current={
                                                active ? 'true' : undefined
                                            }
                                            onClick={() => choose(item.id)}
                                            className={cn(
                                                'w-full px-4 py-3 text-left hover:bg-surface-2/60',
                                                active &&
                                                    'bg-brand-50/60 shadow-[inset_3px_0_0_var(--primary)] dark:bg-brand-500/10',
                                            )}
                                        >
                                            <span className="flex items-center justify-between gap-2">
                                                <span className="flex items-center gap-2 text-sm font-medium text-text">
                                                    {item.name}
                                                    {active && dirty && (
                                                        <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-normal text-warning">
                                                            Belum disimpan
                                                        </span>
                                                    )}
                                                    {!item.is_active && (
                                                        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-normal text-text-muted">
                                                            Nonaktif
                                                        </span>
                                                    )}
                                                </span>
                                                <span className="font-mono text-xs text-text-muted">
                                                    {item.code}
                                                </span>
                                            </span>
                                            <span className="mt-0.5 block truncate text-[13px] text-text-muted">
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
                        <div className="relative">
                            <div className="absolute top-3 right-3 z-10">
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
                        <p className="rounded-xl border border-dashed border-border-strong p-10 text-center text-sm text-text-muted">
                            Belum ada jenis pengajuan. Buat jenis baru.
                        </p>
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
    breadcrumbs: [
        { title: 'Admin', href: index() },
        { title: 'Jenis pengajuan & alur persetujuan', href: index() },
    ],
    title: 'Jenis pengajuan',
    back: '/menu',
};
