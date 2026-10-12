import { Loader2, Plus, RotateCcw, Send, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { CheckFlow } from '../use-check-flow';
import { LocationChip } from './location-chip';
import { resizeRowIds } from './plan-row-ids';

/** Photo preview, WFH/field note and submit. */
export function SelfieReview({
    flow,
    className,
}: {
    flow: CheckFlow;
    className?: string;
}) {
    const submitting = flow.step === 'submitting';
    const label = flow.type === 'in' ? 'Kirim check-in' : 'Kirim check-out';
    // Stable row keys: removing a point must not move focus/IME state onto
    // the next input (index keys would).
    const [rowIds, setRowIds] = useState<string[]>(() =>
        resizeRowIds([], flow.plan.length),
    );

    if (rowIds.length !== flow.plan.length) {
        // Plan reset from outside (new attempt): adjust during render.
        setRowIds(resizeRowIds(rowIds, flow.plan.length));
    }

    return (
        <div className={cn('flex min-h-0 flex-1 flex-col gap-4', className)}>
            <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-border bg-surface">
                {flow.photo && (
                    <img
                        src={flow.photo.url}
                        alt="Selfie yang akan dikirim"
                        className={cn(
                            'absolute inset-0 size-full object-cover',
                            flow.camera.facing === 'user' && '-scale-x-100',
                        )}
                    />
                )}
                <div className="absolute inset-x-0 top-4 flex justify-center px-4">
                    <LocationChip flow={flow} />
                </div>
                {submitting && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/60 text-text">
                        <Loader2 className="size-8 animate-spin" aria-hidden />
                        <p className="text-[15px]" role="status">
                            Mengirim…{' '}
                            {flow.progress > 0 && flow.progress < 100
                                ? `${flow.progress}%`
                                : ''}
                        </p>
                    </div>
                )}
            </div>

            {flow.type === 'in' && (
                <div className="space-y-1.5">
                    <Label className="text-text">
                        Rencana/Laporan kerja hari ini{' '}
                        <span className="text-text-muted">
                            (wajib, terkirim ke grup manajemen)
                        </span>
                    </Label>
                    <ul className="space-y-1.5">
                        {flow.plan.map((point, index) => (
                            <li
                                key={rowIds[index] ?? index}
                                className="flex items-center gap-1.5"
                            >
                                <span
                                    aria-hidden
                                    className="w-5 shrink-0 text-right text-[15px] font-bold text-text-muted tnum"
                                >
                                    {index + 1}.
                                </span>
                                <Input
                                    value={point}
                                    onChange={(event) =>
                                        flow.setPlan(
                                            flow.plan.map((value, i) =>
                                                i === index
                                                    ? event.target.value
                                                    : value,
                                            ),
                                        )
                                    }
                                    maxLength={300}
                                    enterKeyHint="next"
                                    placeholder={
                                        index === 0
                                            ? 'Mis. Selesaikan laporan mingguan'
                                            : 'Poin berikutnya'
                                    }
                                    aria-label={`Poin rencana kerja ${index + 1}`}
                                    aria-invalid={
                                        flow.planError ? true : undefined
                                    }
                                    aria-describedby={
                                        flow.planError
                                            ? 'check-plan-error'
                                            : undefined
                                    }
                                    className="h-11"
                                />
                                {flow.plan.length > 1 && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => {
                                            setRowIds(
                                                rowIds.filter(
                                                    (_, i) => i !== index,
                                                ),
                                            );
                                            flow.setPlan(
                                                flow.plan.filter(
                                                    (_, i) => i !== index,
                                                ),
                                            );
                                        }}
                                        disabled={submitting}
                                        aria-label={`Hapus poin ${index + 1}`}
                                        className="size-11 shrink-0 text-text-muted"
                                    >
                                        <X aria-hidden />
                                    </Button>
                                )}
                            </li>
                        ))}
                    </ul>
                    {flow.plan.length < 8 && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => flow.setPlan([...flow.plan, ''])}
                            disabled={submitting}
                            className="text-text-muted"
                        >
                            <Plus aria-hidden />
                            Tambah poin
                        </Button>
                    )}
                    {flow.planError && (
                        <p
                            id="check-plan-error"
                            className="text-[15px] text-danger"
                        >
                            {flow.planError}
                        </p>
                    )}
                </div>
            )}

            {(flow.isRemote || flow.noteError) && (
                <div className="space-y-1.5">
                    <Label htmlFor="check-note" className="text-text">
                        Catatan lokasi / aktivitas{' '}
                        <span className="text-text-muted">
                            (wajib untuk WFH/lapangan)
                        </span>
                    </Label>
                    <Textarea
                        id="check-note"
                        value={flow.note}
                        onChange={(event) => flow.setNote(event.target.value)}
                        maxLength={500}
                        rows={2}
                        placeholder="Mis. rumah, menyusun laporan bulanan"
                        aria-invalid={flow.noteError ? true : undefined}
                        aria-describedby={
                            flow.noteError ? 'check-note-error' : undefined
                        }
                        className="min-h-12"
                    />
                    {flow.noteError && (
                        <p
                            id="check-note-error"
                            className="text-[15px] text-danger"
                        >
                            {flow.noteError}
                        </p>
                    )}
                </div>
            )}

            <div className="grid grid-cols-[auto_1fr] gap-3 pb-[calc(env(safe-area-inset-bottom)+8px)]">
                <Button
                    type="button"
                    variant="outline"
                    onClick={flow.retake}
                    disabled={submitting}
                    size="lg"
                    className="px-5"
                >
                    <RotateCcw aria-hidden />
                    Ulangi
                </Button>
                <Button
                    type="button"
                    onClick={() => void flow.submit()}
                    disabled={submitting}
                    size="lg"
                >
                    {submitting ? (
                        <Loader2 className="animate-spin" aria-hidden />
                    ) : (
                        <Send aria-hidden />
                    )}
                    {label}
                </Button>
            </div>
        </div>
    );
}
