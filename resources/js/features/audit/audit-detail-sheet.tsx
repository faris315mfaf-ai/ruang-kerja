import type { ReactNode } from 'react';
import { UserAvatar } from '@/components/shell/user-avatar';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { formatDateTime, formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import { actionLabel, diffRows, formatValue } from './labels';
import type { AuditRow } from './types';

type Props = {
    row: AuditRow | null;
    references: Record<string, string>;
    onClose: () => void;
};

function Meta({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="grid grid-cols-[120px_1fr] gap-3 py-3 text-[15px]">
            <dt className="text-text-muted">{label}</dt>
            <dd className="min-w-0 break-words text-text">{children}</dd>
        </div>
    );
}

/** Read-only detail of one audit entry with a before/after diff. */
export function AuditDetailSheet({ row, references, onClose }: Props) {
    const rows = row ? diffRows(row.oldValues, row.newValues) : [];
    const changedOnly = row?.oldValues !== null && row?.newValues !== null;

    return (
        <Sheet open={row !== null} onOpenChange={(open) => !open && onClose()}>
            <SheetContent className="w-full gap-0 overflow-y-auto bg-surface p-0 sm:max-w-[560px]">
                {row && (
                    <>
                        <SheetHeader className="border-b border-border px-6 py-5">
                            <SheetTitle className="pr-6 text-h3 text-text">
                                {actionLabel(row.action)}
                            </SheetTitle>
                            <SheetDescription className="font-mono text-meta text-text-muted">
                                {row.action}
                            </SheetDescription>
                        </SheetHeader>

                        <dl className="divide-y divide-divider px-6 py-2">
                            <Meta label="Waktu">
                                {formatDateTime(row.createdAt)}
                                <span className="ml-2 text-text-muted">
                                    {formatRelative(row.createdAt)}
                                </span>
                            </Meta>
                            <Meta label="Aktor">
                                {row.actor ? (
                                    <span className="flex items-center gap-2">
                                        <UserAvatar
                                            name={row.actor.name}
                                            src={row.actor.avatar}
                                        />
                                        {row.actor.name}
                                    </span>
                                ) : (
                                    <span className="text-text-muted">
                                        Sistem (otomatis)
                                    </span>
                                )}
                            </Meta>
                            <Meta label="Subjek">
                                {row.subject ? (
                                    <>
                                        <span className="text-text-muted">
                                            {row.subject.typeLabel} ·{' '}
                                        </span>
                                        {row.subject.name ?? row.subject.id}
                                        {row.subject.deleted && (
                                            <span className="ml-2 inline-flex h-6 items-center rounded-full bg-surface-2 px-2 text-[13px] font-semibold text-text-muted">
                                                sudah dihapus
                                            </span>
                                        )}
                                    </>
                                ) : (
                                    '–'
                                )}
                            </Meta>
                            <Meta label="Alamat IP">
                                <span className="font-mono text-meta">
                                    {row.ipAddress ?? '–'}
                                </span>
                            </Meta>
                            <Meta label="Perangkat">
                                <span className="text-meta text-text-muted">
                                    {row.userAgent ?? '–'}
                                </span>
                            </Meta>
                        </dl>

                        <section className="px-6 pt-3 pb-6">
                            <h3 className="mb-3 text-title text-text">
                                Perubahan
                            </h3>
                            {rows.length === 0 ? (
                                <p className="rounded-lg border border-dashed border-border-strong px-4 py-6 text-center text-meta text-text-muted">
                                    Tidak ada nilai yang dicatat untuk aksi ini.
                                </p>
                            ) : (
                                <div className="overflow-hidden rounded-lg border border-border">
                                    <table className="w-full table-fixed text-meta">
                                        <thead className="bg-background text-left text-meta text-text-muted">
                                            <tr>
                                                <th className="w-[30%] px-3 py-2.5 font-bold">
                                                    Kolom
                                                </th>
                                                <th className="px-3 py-2.5 font-bold">
                                                    Sebelum
                                                </th>
                                                <th className="px-3 py-2.5 font-bold">
                                                    Sesudah
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-divider">
                                            {rows.map((diff) => (
                                                <tr
                                                    key={diff.key}
                                                    className="align-top"
                                                >
                                                    <td className="px-3 py-2.5 text-text-muted">
                                                        {diff.label}
                                                    </td>
                                                    <td
                                                        className={cn(
                                                            'px-3 py-2.5 break-words',
                                                            diff.changed &&
                                                                row.oldValues
                                                                ? 'bg-danger/5 text-danger'
                                                                : 'text-text',
                                                        )}
                                                    >
                                                        {formatValue(
                                                            diff.key,
                                                            diff.before,
                                                            references,
                                                        )}
                                                    </td>
                                                    <td
                                                        className={cn(
                                                            'px-3 py-2.5 break-words',
                                                            diff.changed &&
                                                                row.newValues
                                                                ? 'bg-success/5 text-success'
                                                                : 'text-text',
                                                        )}
                                                    >
                                                        {formatValue(
                                                            diff.key,
                                                            diff.after,
                                                            references,
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            {changedOnly && rows.length > 0 && (
                                <p className="mt-2 text-meta text-text-muted">
                                    Hanya kolom yang berubah yang dicatat. Nilai
                                    rahasia disamarkan (***).
                                </p>
                            )}
                        </section>
                    </>
                )}
            </SheetContent>
        </Sheet>
    );
}
