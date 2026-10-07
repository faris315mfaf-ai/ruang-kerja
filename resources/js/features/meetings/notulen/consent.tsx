import { FileText } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { ApiError } from '@/features/tasks/lib/api';
import { cn } from '@/lib/utils';
import { notulenApi } from './api';
import type { NotulenSummary } from './types';

/** Auto minutes are on for this meeting (consent card / chip shown). */
export function autoMinutesOn(notulen: NotulenSummary | null | undefined) {
    return Boolean(notulen?.available && notulen.auto_minutes);
}

/**
 * "Jangan transkrip suara saya" (contract §3): saved on the server before
 * joining; in the room the LiveKit attribute follows (`onAttributes`).
 */
export function useConsent(
    notulen: NotulenSummary | null | undefined,
    onAttributes?: (attributes: Record<string, string>) => void,
) {
    const [optedOut, setOptedOut] = useState(
        notulen?.consent.opted_out ?? false,
    );
    const [saving, setSaving] = useState(false);

    const change = async (next: boolean) => {
        if (!notulen || saving) {
            return;
        }

        setOptedOut(next);
        setSaving(true);

        try {
            const response = await notulenApi.consent(notulen.links, next);
            setOptedOut(response.opted_out);
            onAttributes?.(response.attributes);
            toast.success(
                response.opted_out
                    ? 'Suara Anda tidak akan ditranskrip'
                    : 'Suara Anda ikut ditranskrip',
            );
        } catch (error) {
            setOptedOut(!next);
            toast.error(
                error instanceof ApiError
                    ? error.message
                    : 'Pilihan belum tersimpan. Coba lagi.',
            );
        } finally {
            setSaving(false);
        }
    };

    return { optedOut, saving, change };
}

/**
 * Consent card (pre-join, mockup consentBox): what happens to the audio,
 * who sees the transcript, how long, and the opt-out switch. The notice
 * text comes from the server (UU PDP) when it sends one.
 */
export function ConsentCard({
    notulen,
    consent,
    className,
}: {
    notulen: NotulenSummary;
    consent: ReturnType<typeof useConsent>;
    className?: string;
}) {
    const id = 'notulen-consent';

    return (
        <section
            aria-labelledby={`${id}-title`}
            className={cn(
                'flex flex-col gap-2.5 rounded-[18px] border border-border bg-surface px-4 py-3.5 text-text shadow-card',
                className,
            )}
            data-testid="consent-card"
        >
            <div className="flex items-start gap-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-info-soft text-info">
                    <FileText aria-hidden className="size-[18px]" />
                </span>
                <div className="flex flex-col gap-0.5">
                    <h2 id={`${id}-title`} className="text-[14px] font-bold">
                        Notulen otomatis aktif
                    </h2>
                    <p className="text-[12px] leading-[17px] text-text-muted">
                        Suara Anda ditranskrip setelah rapat, audio langsung
                        dihapus. Transkrip hanya untuk peserta,{' '}
                        {notulen.retention_days} hari.
                        {notulen.llm.enabled &&
                            notulen.llm.outside_indonesia &&
                            ` Ringkasan dibuat AI (${notulen.llm.provider ?? 'penyedia luar'}, server di luar Indonesia).`}
                    </p>
                </div>
            </div>
            {notulen.consent.can_change && (
                <label className="flex items-center gap-2.5 text-[13px] font-semibold">
                    <Switch
                        checked={consent.optedOut}
                        disabled={consent.saving}
                        onCheckedChange={(next) => void consent.change(next)}
                        aria-describedby={`${id}-title`}
                    />
                    Jangan transkrip suara saya
                </label>
            )}
        </section>
    );
}

/** "● Notulen otomatis aktif · Subtitle ID" (room chip). */
export function LiveChip({
    autoMinutes,
    subtitles,
    className,
}: {
    autoMinutes: boolean;
    subtitles: boolean;
    className?: string;
}) {
    if (!autoMinutes && !subtitles) {
        return null;
    }

    return (
        <span
            className={cn(
                'inline-flex items-center gap-2 rounded-full bg-info-soft px-3 py-1.5 text-[13px] leading-[18px] font-semibold text-info',
                className,
            )}
            data-testid="live-chip"
        >
            <span
                aria-hidden
                className="size-2 shrink-0 rounded-full bg-tag-pink"
            />
            {[
                autoMinutes && 'Notulen otomatis aktif',
                subtitles && 'Subtitle ID',
            ]
                .filter(Boolean)
                .join(' · ')}
        </span>
    );
}
