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
                    <p className="py-6 text-center text-sm text-text-muted">
                        Belum ada log pada bulan ini.
                    </p>
                ) : (
                    <ul className="divide-y divide-border rounded-lg border border-border">
                        {logs.map((log) => (
                            <li
                                key={log.id}
                                className="grid gap-1.5 px-3 py-2.5 text-sm"
                            >
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <span className="font-medium text-text">
                                        {formatDate(log.occurredAt)}
                                    </span>
                                    <span className="font-mono text-text tnum">
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
                                        <span
                                            key={flag.value}
                                            className="inline-flex h-5 items-center rounded-full bg-warning-soft px-2 text-xs text-warning"
                                        >
                                            {flag.label}
                                        </span>
                                    ))}
                                    {log.reviewedAt && (
                                        <span className="text-xs text-success">
                                            Sudah ditinjau
                                        </span>
                                    )}
                                </div>
                                {log.note && (
                                    <p className="text-[13px] text-text-muted">
                                        {log.isCorrection
                                            ? `Alasan koreksi: ${log.note}`
                                            : log.note}
                                    </p>
                                )}
                                {(log.canViewSelfie || log.canReview) && (
                                    <div className="flex gap-2">
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
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                    >
                        Tutup
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
