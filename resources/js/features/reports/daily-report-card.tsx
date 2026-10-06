import { Link } from '@inertiajs/react';
import { ClipboardPen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { STATUS_TONES, statusText } from './lib';
import type { TodayReportStatus } from './types';

const DESCRIPTION = {
    missing:
        'Tulis tugas yang dikerjakan, hambatan, dan catatan hari ini sebelum pukul 23.59.',
    draft: 'Draf tersimpan, belum dikirim ke atasan.',
    submitted: 'Atasan Anda bisa membacanya. Masih bisa diubah sampai 23.59.',
} as const;

const ACTION = {
    missing: 'Tulis laporan',
    draft: 'Lanjutkan & kirim',
    submitted: 'Ubah laporan',
} as const;

/**
 * Beranda card "Laporan hari ini" (keputusan pemilik 6 Okt 2026): status
 * (Belum lapor · Draf · Terkirim pukul …) and the button to the form.
 * `prominent` = the larger staff version.
 */
export function DailyReportCard({
    status,
    prominent = false,
    compact = false,
    className,
}: {
    status: TodayReportStatus | undefined;
    prominent?: boolean;
    /** Phone: tighter padding, full-width button. */
    compact?: boolean;
    className?: string;
}) {
    if (!status) {
        return null;
    }

    const items =
        status.status !== 'missing' && status.items_count > 0
            ? ` · ${status.items_count} pekerjaan`
            : '';

    return (
        <section
            aria-labelledby="daily-report-card"
            className={cn(
                'flex min-w-0 flex-col gap-3 rounded-card border bg-surface shadow-card',
                compact ? 'p-4' : 'p-5 md:p-6',
                prominent && status.status !== 'submitted'
                    ? 'border-primary/40 ring-1 ring-primary/20'
                    : 'border-border',
                className,
            )}
        >
            <div className="flex items-start gap-3">
                <span
                    aria-hidden
                    className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-grad-soft text-primary"
                >
                    <ClipboardPen className="size-[22px]" strokeWidth={1.9} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <h2
                        id="daily-report-card"
                        className="text-title font-bold text-text"
                    >
                        Laporan hari ini
                    </h2>
                    <Badge
                        variant="status"
                        tone={STATUS_TONES[status.status]}
                        dot
                        className="h-7 w-fit px-2.5 text-[14px]"
                    >
                        {statusText(status.status, status.submitted_at)}
                        {items}
                    </Badge>
                </div>
            </div>
            <p className="text-[15px] leading-[22px] text-text-muted">
                {DESCRIPTION[status.status]}
            </p>
            <div className="mt-auto flex flex-wrap items-center gap-2">
                <Button
                    asChild
                    size={compact ? 'lg' : 'default'}
                    variant={
                        status.status === 'submitted' ? 'outline' : 'default'
                    }
                    className={cn(compact && 'flex-1')}
                >
                    <Link href="/laporan/hari-ini">
                        {ACTION[status.status]}
                    </Link>
                </Button>
                <Button
                    asChild
                    variant="quiet"
                    size={compact ? 'lg' : 'default'}
                >
                    <Link href="/laporan">Riwayat</Link>
                </Button>
            </div>
        </section>
    );
}
