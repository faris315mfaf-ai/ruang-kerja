import { Link } from '@inertiajs/react';
import { AlertTriangle, Clock, FileText } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { BottomSheet } from '@/components/mobile/bottom-sheet';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Badge } from '@/components/ui/badge';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, formatTime } from '@/lib/format';
import { requestJson } from '@/lib/http';
import { cn, focusRing } from '@/lib/utils';
import type { MonitoredReport, ReportItem } from './types';

type State =
    | { status: 'closed' }
    | { status: 'loading'; id: string }
    | { status: 'ready'; report: MonitoredReport }
    | { status: 'error'; id: string };

/**
 * Opens one sent daily report (GET /monitoring/laporan/{id}, JSON) in a side
 * sheet or a bottom sheet. A report already on the page shows at once and
 * is refreshed from the server (notes are only in the detail).
 */
export function useReportDetail() {
    const [state, setState] = useState<State>({ status: 'closed' });
    const current = useRef<string | null>(null);

    const open = useCallback((id: string, known?: MonitoredReport) => {
        current.current = id;
        setState(
            known
                ? { status: 'ready', report: known }
                : { status: 'loading', id },
        );

        requestJson<{ report: MonitoredReport }>(`/monitoring/laporan/${id}`)
            .then(({ report }) => {
                if (current.current === id) {
                    setState({ status: 'ready', report });
                }
            })
            .catch(() => {
                if (current.current === id && !known) {
                    setState({ status: 'error', id });
                }
            });
    }, []);

    const close = useCallback(() => {
        current.current = null;
        setState({ status: 'closed' });
    }, []);

    return { state, open, close };
}

export function ReportItems({ items }: { items: ReportItem[] }) {
    if (items.length === 0) {
        return (
            <p className="text-meta text-text-muted">
                Tidak ada rincian tugas.
            </p>
        );
    }

    return (
        <ul className="flex flex-col gap-2.5">
            {items.map((item) => (
                <li
                    key={item.id}
                    className="flex flex-col gap-1 rounded-lg bg-surface-2/70 px-3.5 py-2.5"
                >
                    <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        {item.key && (
                            <span className="font-mono text-[14px] font-semibold text-text-muted">
                                {item.key}
                            </span>
                        )}
                        {item.url && item.title ? (
                            <Link
                                href={item.url}
                                className={cn(
                                    'min-w-0 rounded-sm text-[16px] font-semibold text-link hover:underline',
                                    focusRing,
                                )}
                            >
                                {item.title}
                            </Link>
                        ) : (
                            <span className="text-[16px] font-semibold">
                                {item.key ? 'Tugas' : 'Di luar tugas'}
                            </span>
                        )}
                        {item.percent !== null && (
                            <Badge
                                variant="status"
                                tone="info"
                                className="h-6 tnum"
                            >
                                {item.percent}%
                            </Badge>
                        )}
                        {item.hours !== null && (
                            <span className="text-meta text-text-muted tnum">
                                {String(item.hours).replace('.', ',')} jam
                            </span>
                        )}
                    </span>
                    <span className="text-[15px] leading-6 whitespace-pre-line text-text-muted">
                        {item.progress_note}
                    </span>
                </li>
            ))}
        </ul>
    );
}

export function BlockerNote({ text }: { text: string }) {
    return (
        <p className="flex items-start gap-2 rounded-lg bg-warning-soft px-3.5 py-2.5 text-[15px] leading-6 text-warning">
            <AlertTriangle className="mt-1 size-4 shrink-0" aria-hidden />
            <span className="whitespace-pre-line">
                <span className="font-bold">Hambatan: </span>
                {text}
            </span>
        </p>
    );
}

function Body({ state }: { state: State }) {
    if (state.status === 'loading') {
        return (
            <div className="flex flex-col gap-3" aria-busy>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
            </div>
        );
    }

    if (state.status === 'error') {
        return (
            <p role="alert" className="text-body text-danger">
                Laporan tidak dapat dibuka. Mungkin laporan ini belum dikirim
                atau Anda tidak berhak melihatnya.
            </p>
        );
    }

    if (state.status !== 'ready') {
        return null;
    }

    const { report } = state;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
                <UserAvatar
                    name={report.user.name}
                    src={report.user.avatar}
                    className="size-11 text-[15px]"
                />
                <div className="flex min-w-0 flex-col">
                    <span className="truncate text-title">
                        {report.user.name}
                    </span>
                    <span className="flex items-center gap-1.5 text-meta text-text-muted">
                        {report.user.division ?? 'Tanpa divisi'}
                        {report.submitted_at && (
                            <>
                                <span aria-hidden>·</span>
                                <Clock className="size-3.5" aria-hidden />
                                {formatTime(report.submitted_at)}
                            </>
                        )}
                    </span>
                </div>
            </div>
            {report.summary && (
                <p className="text-body whitespace-pre-line">
                    {report.summary}
                </p>
            )}
            {report.blockers && <BlockerNote text={report.blockers} />}
            <section
                aria-label="Tugas yang dikerjakan"
                className="flex flex-col gap-2"
            >
                <h3 className="text-label">
                    Tugas yang dikerjakan ({report.items_count})
                    {report.hours !== null &&
                        ` · ${String(report.hours).replace('.', ',')} jam`}
                </h3>
                <ReportItems items={report.items} />
            </section>
            {report.notes && (
                <section aria-label="Catatan" className="flex flex-col gap-1.5">
                    <h3 className="flex items-center gap-1.5 text-label">
                        <FileText className="size-4" aria-hidden />
                        Catatan
                    </h3>
                    <p className="text-[15px] leading-6 whitespace-pre-line text-text-muted">
                        {report.notes}
                    </p>
                </section>
            )}
        </div>
    );
}

/** Detail of one report: side sheet on desktop/tablet, bottom sheet on phones. */
export function ReportDetailSheet({
    state,
    onClose,
    mobile,
}: {
    state: State;
    onClose: () => void;
    mobile: boolean;
}) {
    const open = state.status !== 'closed';
    const title =
        state.status === 'ready'
            ? `Laporan ${formatDate(state.report.date)}`
            : 'Laporan harian';

    if (mobile) {
        return (
            <BottomSheet
                open={open}
                onOpenChange={(value) => !value && onClose()}
                title={title}
            >
                <div className="pb-6">
                    <Body state={state} />
                </div>
            </BottomSheet>
        );
    }

    return (
        <Sheet open={open} onOpenChange={(value) => !value && onClose()}>
            <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-[560px]">
                <SheetHeader className="px-6 pt-6 pb-4">
                    <SheetTitle className="text-h3">{title}</SheetTitle>
                    <SheetDescription>
                        Laporan progres kerja harian (baca saja).
                    </SheetDescription>
                </SheetHeader>
                <div className="px-6 pb-8">
                    <Body state={state} />
                </div>
            </SheetContent>
        </Sheet>
    );
}

export type ReportDetailState = State;
