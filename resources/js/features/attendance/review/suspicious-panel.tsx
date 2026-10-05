import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
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

/** Cards shown before "Tampilkan semua". */
const PREVIEW = 3;

/** "Perlu ditinjau" (DHR): flagged check-ins as grey cards with actions. */
export function SuspiciousPanel({
    items,
    total,
    reload,
    variant = 'desktop',
    className,
}: Props) {
    const mobile = variant === 'mobile';
    const [expanded, setExpanded] = useState(false);
    const shown = expanded ? items : items.slice(0, PREVIEW);

    return (
        <Panel
            title={
                <>
                    Perlu ditinjau
                    <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-danger bg-grad-hangat px-2.5 text-[15px] font-bold text-on-brand tnum">
                        {total}
                    </span>
                </>
            }
            className={className}
            bodyClassName="gap-3.5"
        >
            {items.length === 0 ? (
                <p className="flex gap-2 rounded-lg bg-success-soft p-4 text-[15px] leading-[22px] text-success">
                    <ShieldCheck
                        className="mt-0.5 size-5 shrink-0"
                        aria-hidden
                    />
                    Tidak ada temuan. Diperiksa: akurasi GPS, perangkat & IP
                    baru, jam perangkat, lompatan lokasi, selfie gelap.
                </p>
            ) : (
                <ul className="flex flex-col gap-3">
                    {shown.map((log) => {
                        const detail = flagDetail(log);

                        return (
                            <li
                                key={log.id}
                                className="flex flex-col gap-2.5 rounded-[18px] bg-background p-4"
                            >
                                <div className="flex items-center gap-3">
                                    <span
                                        aria-hidden
                                        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-danger-soft text-[15px] font-bold text-danger"
                                    >
                                        {log.initials}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-[16px] leading-6 font-bold text-text">
                                            {log.name}
                                        </p>
                                        <p className="truncate text-[15px] leading-[22px] text-text-muted">
                                            {log.typeLabel}{' '}
                                            {formatTime(log.occurredAt)} ·{' '}
                                            {log.locationName ??
                                                log.methodLabel}
                                        </p>
                                    </div>
                                </div>
                                <FlagChips log={log} />
                                {detail && (
                                    <p className="text-[15px] leading-[22px] font-semibold text-danger">
                                        {detail}
                                    </p>
                                )}
                                {(log.canViewSelfie || log.canReview) && (
                                    <div
                                        className={cn(
                                            'flex flex-wrap gap-2',
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
                        );
                    })}
                </ul>
            )}

            {items.length > PREVIEW && (
                <Button
                    type="button"
                    variant="quiet"
                    className="self-start"
                    aria-expanded={expanded}
                    onClick={() => setExpanded((open) => !open)}
                >
                    {expanded
                        ? 'Tampilkan lebih sedikit'
                        : `Tampilkan semua (${items.length})`}
                </Button>
            )}
            {total > items.length && (
                <p className="text-meta text-text-muted">
                    Menampilkan {items.length} dari {total} log terbaru.
                </p>
            )}
            <p className="flex items-center gap-1.5 text-[14px] leading-5 text-text-muted">
                <ShieldCheck className="size-4 shrink-0" aria-hidden />
                Melihat selfie selalu tercatat di audit log.
            </p>
        </Panel>
    );
}

function FlagChips({ log }: { log: SuspiciousLog }) {
    return (
        <span className="flex flex-wrap gap-1.5">
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
        </span>
    );
}
