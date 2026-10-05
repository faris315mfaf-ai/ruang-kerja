import { Head, Link, router, usePage } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, Eye, ScrollText } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import AlertError from '@/components/alert-error';
import { DesktopOnlyNotice } from '@/components/desktop-only-notice';
import { EmptyState } from '@/components/empty-state';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { AdminPageHeader } from '@/features/admin/page-header';
import { AuditDetailSheet } from '@/features/audit/audit-detail-sheet';
import { AuditFilterBar } from '@/features/audit/audit-filters';
import { actionLabel, changeSummary } from '@/features/audit/labels';
import type {
    AuditFilters,
    AuditOptions,
    AuditPage,
    AuditRow,
} from '@/features/audit/types';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { formatDate, formatNumber, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';

type Props = {
    filters: AuditFilters;
    logs: AuditPage;
    references: Record<string, string>;
    options: AuditOptions;
};

const AUDIT_URL = '/admin/audit';
const HEAD = 'first:pl-6 last:pr-6';
const CELL = 'py-3.5 first:pl-6 last:pr-6';

/** Query string for the filters, without empty values. */
function query(filters: AuditFilters): Record<string, string> {
    return Object.fromEntries(
        Object.entries(filters).filter(
            (entry): entry is [string, string] => entry[1] !== null,
        ),
    );
}

/** Admin › Audit log (Super Admin, read-only, desktop only). */
export default function AuditLogIndex({
    filters,
    logs,
    references,
    options,
}: Props) {
    const breakpoint = useBreakpoint();
    const { errors } = usePage().props;
    const [selected, setSelected] = useState<AuditRow | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const offStart = router.on('start', () => setLoading(true));
        const offFinish = router.on('finish', () => setLoading(false));

        return () => {
            offStart();
            offFinish();
        };
    }, []);

    if (breakpoint === 'mobile') {
        return (
            <>
                <Head title="Audit log" />
                <DesktopOnlyNotice feature="Audit log" />
            </>
        );
    }

    const applyFilters = (next: AuditFilters) => {
        router.get(AUDIT_URL, query(next), {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const filterErrors = Object.values(errors ?? {});
    const filtered = Object.values(filters).some((value) => value !== null);

    return (
        <>
            <Head title="Audit log" />

            <div className="flex flex-col gap-6">
                <AdminPageHeader
                    title="Audit log"
                    description={`${formatNumber(logs.total)} catatan · perubahan data master, peran, dan aksi sensitif. Hanya bisa dibaca, tidak bisa diubah.`}
                />

                <AuditFilterBar
                    filters={filters}
                    options={options}
                    onChange={applyFilters}
                />

                {filterErrors.length > 0 && (
                    <AlertError
                        title="Filter tidak valid."
                        errors={filterErrors}
                    />
                )}

                <div
                    aria-busy={loading}
                    className={cn(
                        'overflow-hidden rounded-panel border border-border bg-surface shadow-card transition-opacity duration-180 ease-brand motion-reduce:transition-none',
                        loading && 'opacity-60',
                    )}
                >
                    {logs.data.length === 0 ? (
                        <EmptyState
                            icon={ScrollText}
                            title={
                                filtered
                                    ? 'Tidak ada catatan yang cocok'
                                    : 'Belum ada catatan audit'
                            }
                            description={
                                filtered
                                    ? 'Ubah atau atur ulang filter untuk melihat catatan lain.'
                                    : 'Perubahan karyawan, divisi, tim, jabatan, dan peran akan tercatat di sini.'
                            }
                            action={
                                filtered ? (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            applyFilters({
                                                aktor: null,
                                                aksi: null,
                                                subjek: null,
                                                dari: null,
                                                sampai: null,
                                            })
                                        }
                                    >
                                        Atur ulang filter
                                    </Button>
                                ) : undefined
                            }
                            className="m-5 border-0"
                        />
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className={HEAD}>
                                        Waktu
                                    </TableHead>
                                    <TableHead className={HEAD}>
                                        Aktor
                                    </TableHead>
                                    <TableHead className={HEAD}>Aksi</TableHead>
                                    <TableHead className={HEAD}>
                                        Subjek
                                    </TableHead>
                                    <TableHead className={HEAD}>
                                        Perubahan
                                    </TableHead>
                                    <TableHead className={HEAD}>IP</TableHead>
                                    <TableHead className={HEAD}>
                                        <span className="sr-only">Detail</span>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {logs.data.map((row) => (
                                    <TableRow
                                        key={row.id}
                                        className="cursor-pointer"
                                        onClick={() => setSelected(row)}
                                    >
                                        <TableCell
                                            className={cn(CELL, 'tabular-nums')}
                                        >
                                            <span className="block text-text">
                                                {formatDate(row.createdAt)}
                                            </span>
                                            <span className="text-meta text-text-muted">
                                                {formatTime(row.createdAt)}
                                            </span>
                                        </TableCell>
                                        <TableCell className={CELL}>
                                            {row.actor ? (
                                                <span className="flex items-center gap-2">
                                                    <UserAvatar
                                                        name={row.actor.name}
                                                        src={row.actor.avatar}
                                                    />
                                                    <span className="text-text">
                                                        {row.actor.name}
                                                    </span>
                                                </span>
                                            ) : (
                                                <span className="text-text-muted">
                                                    Sistem
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className={CELL}>
                                            <span className="block font-semibold text-text">
                                                {actionLabel(row.action)}
                                            </span>
                                            <span className="font-mono text-[12px] font-semibold text-text-muted">
                                                {row.action}
                                            </span>
                                        </TableCell>
                                        <TableCell
                                            className={cn(CELL, 'max-w-56')}
                                        >
                                            {row.subject ? (
                                                <>
                                                    <span className="block text-meta text-text-muted">
                                                        {row.subject.typeLabel}
                                                    </span>
                                                    <span
                                                        className={cn(
                                                            'block truncate',
                                                            row.subject.deleted
                                                                ? 'text-text-muted line-through'
                                                                : 'text-text',
                                                        )}
                                                    >
                                                        {row.subject.name ??
                                                            row.subject.id}
                                                    </span>
                                                </>
                                            ) : (
                                                <span className="text-text-subtle">
                                                    –
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell
                                            className={cn(
                                                CELL,
                                                'max-w-64 truncate text-text-muted',
                                            )}
                                        >
                                            {changeSummary(
                                                row.oldValues,
                                                row.newValues,
                                            )}
                                        </TableCell>
                                        <TableCell
                                            className={cn(
                                                CELL,
                                                'font-mono text-[13px] font-semibold text-text-muted',
                                            )}
                                        >
                                            {row.ipAddress ?? '–'}
                                        </TableCell>
                                        <TableCell className={cn(CELL, 'w-px')}>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon-sm"
                                                aria-label={`Lihat detail ${actionLabel(row.action)}`}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    setSelected(row);
                                                }}
                                            >
                                                <Eye />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}

                    {logs.total > 0 && (
                        <div className="flex items-center justify-between border-t border-divider px-6 py-3 text-meta text-text-muted">
                            <span className="tabular-nums">
                                {formatNumber(logs.from ?? 0)}–
                                {formatNumber(logs.to ?? 0)} dari{' '}
                                {formatNumber(logs.total)}
                            </span>
                            <nav
                                aria-label="Halaman"
                                className="flex items-center gap-2"
                            >
                                <PageLink
                                    href={logs.prevUrl}
                                    label="Halaman sebelumnya"
                                >
                                    <ChevronLeft />
                                </PageLink>
                                <span className="tabular-nums">
                                    {logs.currentPage} / {logs.lastPage}
                                </span>
                                <PageLink
                                    href={logs.nextUrl}
                                    label="Halaman berikutnya"
                                >
                                    <ChevronRight />
                                </PageLink>
                            </nav>
                        </div>
                    )}
                </div>
            </div>

            <AuditDetailSheet
                row={selected}
                references={references}
                onClose={() => setSelected(null)}
            />
        </>
    );
}

function PageLink({
    href,
    label,
    children,
}: {
    href: string | null;
    label: string;
    children: ReactNode;
}) {
    if (!href) {
        return (
            <Button
                type="button"
                variant="outline"
                size="icon-sm"
                disabled
                aria-label={label}
            >
                {children}
            </Button>
        );
    }

    return (
        <Button asChild variant="outline" size="icon-sm">
            <Link href={href} preserveScroll preserveState aria-label={label}>
                {children}
            </Link>
        </Button>
    );
}

AuditLogIndex.layout = {
    width: 'wide',
    breadcrumbs: [
        { title: 'Admin', href: '' },
        { title: 'Audit log', href: '/admin/audit' },
    ],
    back: '/menu',
};
