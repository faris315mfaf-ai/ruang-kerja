import { UserRoundCog } from 'lucide-react';
import { useMemo, useState } from 'react';
import { usePage } from '@inertiajs/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Panel } from '@/components/ui/panel';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import briefingRoutes from '@/routes/briefings';
import { submitBriefingForm } from './api';
import {
    contentError,
    delegatablePeriods,
    MAX_CONTENT,
    openPeriod,
    shouldShowRecorderCard,
    windowLabel,
} from './briefing-state';
import { BriefingDelegateDialog } from './delegate-dialog';
import type { BriefingCardData, BriefingPeriodInfo } from './types';
import { useBriefingDraft } from './use-briefing-draft';

/**
 * Kartu "Catat briefing" (keputusan pemilik 9 Okt 2026): the open period's
 * notulensi for HR / Super Admin / the appointed delegate. Saving sends it
 * to every employee (Inbox notification on the first save only — the server
 * is idempotent, so the small edit afterwards silently revises the note).
 * Renders null for everyone else and outside both windows.
 */
export function BriefingCard({
    briefing,
    variant = 'desktop',
}: {
    briefing: BriefingCardData | null | undefined;
    /** 'mobile' = phone card, 'desktop' = Panel card. */
    variant?: 'desktop' | 'mobile';
}) {
    const period =
        briefing === null || briefing === undefined
            ? null
            : openPeriod(briefing);

    if (
        briefing === null ||
        briefing === undefined ||
        period === null ||
        !shouldShowRecorderCard(briefing)
    ) {
        return null;
    }

    return (
        <RecorderCard briefing={briefing} period={period} variant={variant} />
    );
}

function RecorderCard({
    briefing,
    period,
    variant,
}: {
    briefing: BriefingCardData;
    period: BriefingPeriodInfo;
    variant: 'desktop' | 'mobile';
}) {
    const userId = usePage().props.auth.user?.id ?? '';
    const [delegating, setDelegating] = useState(false);
    const [processing, setProcessing] = useState(false);

    const savedNote = briefing.saved?.[period.value] ?? null;
    const { content, setContent, draftSavedAt, clearDraft } = useBriefingDraft({
        userId,
        date: briefing.date,
        period: period.value,
        serverContent: savedNote?.content ?? null,
    });
    const delegatable = useMemo(() => delegatablePeriods(briefing), [briefing]);

    const delegation = briefing.delegations[period.value];
    const appointedBy =
        !briefing.is_recorder &&
        delegation !== undefined &&
        delegation.to.id === userId
            ? delegation.by.name
            : null;
    const error = contentError(content);

    const submit = async () => {
        if (error !== null || processing) {
            return;
        }

        setProcessing(true);
        const ok = await submitBriefingForm(
            briefingRoutes.store(),
            { period: period.value, content },
            'Briefing gagal disimpan.',
        );
        setProcessing(false);

        if (ok) {
            clearDraft();
        }
    };

    const fieldId = `briefing-note-${period.value}`;
    const statusText = processing
        ? 'Menyimpan briefing…'
        : savedNote !== null
          ? 'Briefing terkirim ke semua karyawan. Perubahan setelah ini tersimpan tanpa notifikasi ulang.'
          : draftSavedAt !== null
            ? `Draf tersimpan di perangkat ini pukul ${formatTime(draftSavedAt)}.`
            : 'Draf tersimpan otomatis di perangkat ini.';

    const body = (
        <>
            <p className="text-[15px] leading-[22px] text-text-muted">
                Jendela catat {windowLabel(period)} WIB. Notulensi terkirim ke
                semua karyawan lewat Inbox.
            </p>

            {(delegation !== undefined || appointedBy !== null) && (
                <p className="text-[15px] leading-[22px] text-text">
                    {appointedBy !== null ? (
                        <>
                            Anda ditunjuk oleh <b>{appointedBy}</b> untuk
                            mencatat briefing ini.
                        </>
                    ) : (
                        <>
                            Didelegasikan ke <b>{delegation?.to.name}</b> oleh{' '}
                            {delegation?.by.name}.
                        </>
                    )}
                </p>
            )}

            <div className="flex flex-col gap-2">
                <Label htmlFor={fieldId}>
                    Notulensi {period.label.toLowerCase()}
                </Label>
                <Textarea
                    id={fieldId}
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    maxLength={MAX_CONTENT}
                    placeholder="Tulis poin-poin briefing, satu poin per baris…"
                    className="min-h-40 leading-7"
                    aria-describedby={`${fieldId}-status`}
                />
                <p
                    id={`${fieldId}-status`}
                    role="status"
                    className="text-[14px] leading-5 text-text-muted"
                >
                    {statusText}
                </p>
            </div>

            <div
                className={cn(
                    'flex flex-wrap gap-2',
                    variant === 'mobile' && 'flex-col',
                )}
            >
                <Button
                    onClick={() => void submit()}
                    disabled={error !== null || processing}
                    className={variant === 'mobile' ? 'w-full' : undefined}
                >
                    {processing && <Spinner />}
                    {savedNote !== null
                        ? 'Simpan perubahan'
                        : 'Simpan & kirim ke semua'}
                </Button>
                {briefing.is_recorder && delegatable.length > 0 && (
                    <Button
                        variant="outline"
                        onClick={() => setDelegating(true)}
                        className={variant === 'mobile' ? 'w-full' : undefined}
                    >
                        <UserRoundCog aria-hidden />
                        Delegasikan
                    </Button>
                )}
            </div>
        </>
    );

    const status =
        savedNote !== null ? (
            <Badge variant="status" tone="success" dot>
                Terkirim
            </Badge>
        ) : (
            <Badge variant="status" tone="warning" dot>
                Belum dicatat
            </Badge>
        );

    return (
        <>
            {variant === 'desktop' ? (
                <Panel
                    title={`${period.label} · ${briefing.date_label}`}
                    action={status}
                >
                    <div className="flex flex-col gap-4">{body}</div>
                </Panel>
            ) : (
                <section
                    aria-label={`${period.label} ${briefing.date_label}`}
                    className="flex flex-col gap-4 rounded-[22px] border border-border bg-surface p-5"
                >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="text-[18px] leading-[26px] font-bold">
                            {period.label} · {briefing.date_label}
                        </h2>
                        {status}
                    </div>
                    {body}
                </section>
            )}

            {briefing.is_recorder && (
                <BriefingDelegateDialog
                    briefing={briefing}
                    periods={delegatable}
                    open={delegating}
                    onOpenChange={setDelegating}
                    mobile={variant === 'mobile'}
                />
            )}
        </>
    );
}
