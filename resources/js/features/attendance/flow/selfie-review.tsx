import { Loader2, RotateCcw, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { CheckFlow } from '../use-check-flow';
import { LocationChip } from './location-chip';

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
