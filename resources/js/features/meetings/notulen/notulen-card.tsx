import { Link } from '@inertiajs/react';
import { FileText, Mic } from 'lucide-react';
import { useId } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import notulenRoutes from '@/routes/meetings/notulen';
import { cn } from '@/lib/utils';
import { consentLines } from './consent';
import { formatDuration, TRANSCRIPT_TONE } from './lib';
import type { NotulenSummary } from './types';
import { useNotulen } from './use-notulen';

/**
 * "Transkrip & notulen otomatis" on the meeting detail (video meetings):
 * status chip, the organizer's switch, the viewer's "Jangan transkrip suara
 * saya" (also after the meeting), the UU PDP notice points and the link to
 * the review page (arah C "Notulen otomatis").
 */
export function NotulenCard({
    meetingId,
    date,
    initial = null,
    className,
}: {
    meetingId: string;
    date: string;
    initial?: NotulenSummary | null;
    className?: string;
}) {
    const state = useNotulen(
        initial,
        notulenRoutes.status(meetingId, { query: { tanggal: date } }).url,
    );
    const { summary } = state;
    const autoId = useId();
    const consentId = useId();

    if (
        !summary ||
        (!summary.available && !summary.auto_minutes && !summary.transcript)
    ) {
        return null;
    }

    const transcript = summary.transcript;

    return (
        <section
            aria-labelledby={`${autoId}-title`}
            className={cn(
                'flex flex-col gap-3 rounded-[22px] border border-border bg-surface p-4 md:rounded-panel md:p-6 md:shadow-card',
                className,
            )}
        >
            <div className="flex flex-wrap items-center gap-3">
                <span
                    aria-hidden
                    className="flex size-10 shrink-0 items-center justify-center rounded-control bg-info-soft text-info"
                >
                    <FileText className="size-5" />
                </span>
                <h2
                    id={`${autoId}-title`}
                    className="mr-auto text-[18px] font-bold md:text-[22px] md:leading-[30px]"
                >
                    Notulen otomatis
                </h2>
                {transcript && (
                    <Badge
                        variant="status"
                        tone={TRANSCRIPT_TONE[transcript.status]}
                        dot
                    >
                        {transcript.status_label}
                    </Badge>
                )}
            </div>

            {summary.auto_minutes && consentLines(summary).length > 0 && (
                <ul
                    className="flex flex-col gap-1 rounded-control bg-info-soft px-4 py-3 text-[14px] leading-5 text-info"
                    aria-label="Tentang transkrip"
                >
                    {consentLines(summary).map((line) => (
                        <li key={line} className="flex items-start gap-2">
                            <Mic
                                aria-hidden
                                className="mt-0.5 size-4 shrink-0"
                            />
                            {line}
                        </li>
                    ))}
                </ul>
            )}

            {summary.can_configure && (
                <div className="flex min-h-12 items-center justify-between gap-3">
                    <span className="flex flex-col">
                        <span id={autoId} className="text-[16px] font-semibold">
                            Notulen otomatis
                        </span>
                        <span className="text-[14px] text-text-muted">
                            {summary.available
                                ? `Transkrip setelah rapat + draf AI untuk notulis. Dihapus otomatis setelah ${summary.retention_days} hari.`
                                : 'Belum disiapkan admin di server ini.'}
                        </span>
                    </span>
                    <Switch
                        size="md"
                        checked={summary.auto_minutes}
                        disabled={
                            state.busy !== null ||
                            (!summary.available && !summary.auto_minutes)
                        }
                        onCheckedChange={(checked) =>
                            void state.setAutoMinutes(checked)
                        }
                        aria-labelledby={autoId}
                    />
                </div>
            )}

            {summary.auto_minutes && summary.consent.can_change && (
                <div className="flex min-h-12 items-center justify-between gap-3">
                    <span className="flex flex-col">
                        <span
                            id={consentId}
                            className="text-[16px] font-semibold"
                        >
                            Jangan transkrip suara saya
                        </span>
                        <span className="text-[14px] text-text-muted">
                            Berlaku untuk rapat ini; rekaman suara Anda yang
                            sudah ada ikut dihapus.
                        </span>
                    </span>
                    <Switch
                        size="md"
                        checked={summary.consent.opted_out}
                        disabled={state.busy !== null}
                        onCheckedChange={(checked) =>
                            void state.setOptOut(checked)
                        }
                        aria-labelledby={consentId}
                    />
                </div>
            )}

            {transcript && (
                <p className="text-[15px] text-text-muted">
                    {transcript.status === 'failed'
                        ? (transcript.error ?? 'Transkripsi gagal.')
                        : `${transcript.segment_count} baris · ${transcript.speakers.length} pembicara · ${formatDuration(transcript.duration_seconds)}`}
                    {summary.draft ? ` · ${summary.draft.status_label}` : ''}
                </p>
            )}

            {transcript && summary.can_view_transcript && (
                <Button
                    variant={
                        summary.can_manage && summary.draft?.status === 'ready'
                            ? 'default'
                            : 'outline'
                    }
                    size="lg"
                    className="self-start"
                    asChild
                >
                    <Link href={summary.links.page}>
                        <FileText aria-hidden />
                        {summary.can_manage && summary.draft?.status === 'ready'
                            ? 'Periksa draf notulen'
                            : 'Buka transkrip & draf'}
                    </Link>
                </Button>
            )}
        </section>
    );
}
