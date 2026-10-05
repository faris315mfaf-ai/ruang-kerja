import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { formatDate, formatTime } from '@/lib/format';
import type { RecapLog } from '@/types/attendance';
import { ReviewButton } from '../review/review-button';
import { SelfieButton } from '../review/selfie-dialog';

/** "Lihat N log absensi": every check-in/out of the month (immutable log). */
export function LogsDialog({
    open,
    onOpenChange,
    name,
    logs,
    reload,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    name: string;
    logs: RecapLog[];
    reload: string[];
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Log absensi · {name}</DialogTitle>
                    <DialogDescription>
                        Catatan check-in/check-out tidak bisa diubah; koreksi
                        menambah log baru.
                    </DialogDescription>
                </DialogHeader>
                {logs.length === 0 ? (
                    <p className="py-6 text-center text-[16px] text-text-muted">
                        Belum ada log pada bulan ini.
                    </p>
                ) : (
                    <ul className="divide-y divide-divider overflow-hidden rounded-lg border border-border bg-surface">
                        {logs.map((log) => (
                            <li
                                key={log.id}
                                className="grid gap-2 px-4 py-3 text-[15px]"
                            >
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <span className="font-semibold text-text">
                                        {formatDate(log.occurredAt)}
                                    </span>
                                    <span className="font-semibold text-text tnum">
                                        {formatTime(log.occurredAt)}
                                    </span>
                                    <span className="text-text-muted">
                                        {log.typeLabel} · {log.methodLabel}
                                        {log.locationName
                                            ? ` · ${log.locationName}`
                                            : ''}
                                        {log.accuracyM !== null
                                            ? ` · ±${log.accuracyM} m`
                                            : ''}
                                    </span>
                                    {log.flags.map((flag) => (
                                        <Badge
                                            key={flag.value}
                                            variant="status"
                                            tone="warning"
                                            className="h-7 px-2.5 text-[14px]"
                                        >
                                            {flag.label}
                                        </Badge>
                                    ))}
                                    {log.reviewedAt && (
                                        <span className="text-meta font-semibold text-success">
                                            Sudah ditinjau
                                        </span>
                                    )}
                                </div>
                                {log.note && (
                                    <p className="text-meta text-text-muted">
                                        {log.isCorrection
                                            ? `Alasan koreksi: ${log.note}`
                                            : log.note}
                                    </p>
                                )}
                                {(log.canViewSelfie || log.canReview) && (
                                    <div className="flex flex-wrap gap-2">
                                        {log.canViewSelfie && (
                                            <SelfieButton
                                                logId={log.id}
                                                name={name}
                                                occurredAt={log.occurredAt}
                                            />
                                        )}
                                        {log.canReview && (
                                            <ReviewButton
                                                logId={log.id}
                                                only={reload}
                                            />
                                        )}
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
                <div className="flex justify-end">
                    <Button
                        type="button"
                        variant="quiet"
                        onClick={() => onOpenChange(false)}
                    >
                        Tutup
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
