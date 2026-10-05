import { ShieldCheck } from 'lucide-react';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { SuspiciousLog } from '@/types/attendance';
import { ReviewButton } from './review-button';
import { SelfieButton } from './selfie-dialog';

/** One-line explanation of the strongest flag ("Android, pertama dipakai hari ini"). */
export function flagDetail(log: SuspiciousLog): string | null {
    const values = log.flags.map((flag) => flag.value);

    if (values.includes('low_accuracy') && log.accuracyM !== null) {
        return log.radiusM
            ? `Akurasi GPS ${log.accuracyM} m · radius lokasi ${log.radiusM} m`
            : `Akurasi GPS ${log.accuracyM} m`;
    }

    if (values.includes('clock_skew') && log.clientTime) {
        return `perangkat ${formatTime(log.clientTime)} · server ${formatTime(log.occurredAt)} (dipakai)`;
    }

    if (values.includes('qr_location_mismatch') && log.distanceM !== null) {
        return `GPS ${log.distanceM} m dari kiosk`;
    }

    if (values.includes('new_device')) {
        return 'Perangkat pertama dipakai hari ini';
    }

    return log.note;
}

type Props = {
    items: SuspiciousLog[];
    total: number;
    /** Props to reload after "Tandai ditinjau". */
    reload: string[];
    variant?: 'desktop' | 'mobile';
    className?: string;
};

/** "Perlu ditinjau" (mockups DashboardHR / MDashboardHR). */
export function SuspiciousPanel({
    items,
    total,
    reload,
    variant = 'desktop',
    className,
}: Props) {
    const mobile = variant === 'mobile';

    return (
        <section
            aria-labelledby="review-title"
            className={cn(
                'rounded-xl border border-border bg-surface shadow-card',
                className,
            )}
        >
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <h2
                    id="review-title"
                    className="flex items-center gap-2 text-[15px] font-semibold text-text"
                >
                    Perlu ditinjau
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-warning/12 px-2 text-xs font-semibold text-warning tnum">
                        {total}
                    </span>
                </h2>
                <span className="text-[13px] text-text-muted">
                    absensi tidak biasa
                </span>
            </div>

            {items.length === 0 ? (
                <p className="m-4 flex gap-2 rounded-lg bg-success/10 p-3 text-sm text-success">
                    <ShieldCheck
                        className="mt-0.5 size-4 shrink-0"
                        aria-hidden
                    />
                    Tidak ada temuan. Diperiksa: akurasi GPS, perangkat & IP
                    baru, jam perangkat, lompatan lokasi, selfie gelap.
                </p>
            ) : (
                <ul className="divide-y divide-border">
                    {items.map((log) => (
                        <li key={log.id} className="space-y-2.5 px-4 py-3.5">
                            <div className="flex items-start gap-3">
                                <span
                                    aria-hidden
                                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-on-brand"
                                >
                                    {log.initials}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[15px] font-medium text-text">
                                        {log.name}
                                        {mobile && log.locationName && (
                                            <span className="font-normal text-text-muted">
                                                {' '}
                                                · {log.locationName}
                                            </span>
                                        )}
                                    </p>
                                    {!mobile && (
                                        <p className="truncate text-[13px] text-text-muted">
                                            {log.locationName ??
                                                log.methodLabel}{' '}
                                            · {log.typeLabel.toLowerCase()}{' '}
                                            <span className="font-mono">
                                                {formatTime(log.occurredAt)}
                                            </span>
                                        </p>
                                    )}
                                </div>
                                {mobile ? (
                                    <span className="font-mono text-[15px] text-text tnum">
                                        {formatTime(log.occurredAt)}
                                    </span>
                                ) : (
                                    <FlagChips log={log} />
                                )}
                            </div>
                            {mobile && <FlagChips log={log} />}
                            {flagDetail(log) && (
                                <p className="text-[13px] text-text-muted">
                                    {flagDetail(log)}
                                </p>
                            )}
                            {(log.canViewSelfie || log.canReview) && (
                                <div
                                    className={cn(
                                        'flex gap-2',
                                        mobile && 'grid grid-cols-2',
                                    )}
                                >
                                    {log.canViewSelfie && (
                                        <SelfieButton
                                            logId={log.id}
                                            name={log.name}
                                            occurredAt={log.occurredAt}
                                            size={mobile ? 'lg' : 'sm'}
                                        />
                                    )}
                                    {log.canReview && (
                                        <ReviewButton
                                            logId={log.id}
                                            only={reload}
                                            size={mobile ? 'lg' : 'sm'}
                                        />
                                    )}
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            {total > items.length && (
                <p className="border-t border-border px-4 py-2.5 text-[13px] text-text-muted">
                    Menampilkan {items.length} dari {total} log terbaru.
                </p>
            )}
            <p className="flex items-center gap-1.5 border-t border-border px-4 py-2.5 text-[13px] text-text-muted">
                <ShieldCheck className="size-3.5" aria-hidden />
                Lihat selfie: akses tercatat di audit log.
            </p>
        </section>
    );
}

function FlagChips({ log }: { log: SuspiciousLog }) {
    return (
        <span className="flex flex-wrap gap-1.5">
            {log.flags.map((flag) => (
                <span
                    key={flag.value}
                    className="inline-flex h-6 items-center rounded-full bg-warning/12 px-2.5 text-xs font-medium whitespace-nowrap text-warning"
                >
                    {flag.label}
                </span>
            ))}
        </span>
    );
}
