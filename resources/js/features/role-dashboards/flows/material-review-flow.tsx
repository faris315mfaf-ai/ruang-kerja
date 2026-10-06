import { Check } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useFakeMutation } from '@/features/prototype/use-fake-mutation';
import { cn } from '@/lib/utils';
import { MATERIAL_REVIEW_FLOW } from '../fixtures';
import { reviewButtonLabel } from '../lib';
import type { FlowProps } from './surface';
import { FlowSurface } from './surface';

/** Marketing "Review materi" (PMarketingReview): comment pins, resolve, approve. */
export function MaterialReviewFlowSheet(props: FlowProps) {
    const flow = MATERIAL_REVIEW_FLOW;
    const [active, setActive] = useState(0);
    const [resolved, setResolved] = useState<string[]>([]);
    const [approved, setApproved] = useState(false);
    const { processing, run } = useFakeMutation();
    const comment = flow.comments[active];
    const open = flow.comments.length - resolved.length;
    const isResolved = resolved.includes(comment.id);

    const toggleResolved = () => {
        setApproved(false);
        setResolved((current) =>
            current.includes(comment.id)
                ? current.filter((id) => id !== comment.id)
                : [...current, comment.id],
        );
    };

    return (
        <FlowSurface
            {...props}
            title={flow.title}
            description={flow.version}
            footer={
                <div className="grid grid-cols-[1fr_1.4fr] gap-2">
                    <Button
                        variant="outline"
                        size="lg"
                        onClick={() =>
                            toast.success('Permintaan revisi dikirim ke Dinda')
                        }
                    >
                        Minta revisi
                    </Button>
                    <Button
                        size="lg"
                        disabled={processing || approved}
                        className={cn(
                            !approved && 'bg-grad-hangat shadow-warm',
                        )}
                        onClick={() =>
                            void run(() => setApproved(true), {
                                success:
                                    'Brosur disetujui dan dikirim ke Sekretariat',
                            })
                        }
                    >
                        {processing ? (
                            <Spinner />
                        ) : approved ? (
                            <Check aria-hidden />
                        ) : null}
                        {reviewButtonLabel(open, approved)}
                    </Button>
                </div>
            }
        >
            <div className="relative overflow-hidden rounded-[20px] border border-border bg-surface">
                <div className="flex flex-col gap-1 bg-grad-aksi px-5 pt-5 pb-8 text-on-brand">
                    <span className="text-[12px] font-extrabold tracking-[0.08em]">
                        {flow.eyebrow}
                    </span>
                    <span className="max-w-[80%] text-[22px] leading-7 font-extrabold">
                        {flow.headline}
                    </span>
                </div>
                <div aria-hidden className="flex flex-col gap-2 p-5">
                    <span className="h-2 w-11/12 rounded-full bg-surface-2" />
                    <span className="h-2 w-full rounded-full bg-surface-2" />
                    <span className="h-2 w-4/5 rounded-full bg-surface-2" />
                    <span className="mt-2 grid grid-cols-3 gap-2">
                        <span className="h-14 rounded-[10px] bg-surface-2" />
                        <span className="h-14 rounded-[10px] bg-surface-2" />
                        <span className="h-14 rounded-[10px] bg-surface-2" />
                    </span>
                </div>
                {flow.comments.map((item, index) => {
                    const done = resolved.includes(item.id);

                    return (
                        <button
                            key={item.id}
                            type="button"
                            aria-label={`Komentar ${index + 1}${done ? ', selesai' : ''}`}
                            aria-pressed={index === active}
                            onClick={() => setActive(index)}
                            style={{ left: `${item.x}%`, top: `${item.y}%` }}
                            className={cn(
                                'absolute flex size-11 -translate-x-1/2 items-center justify-center rounded-full text-[15px] font-extrabold text-on-brand shadow-float ring-2 ring-surface transition-transform duration-120 ease-brand outline-none focus-visible:ring-[3px] focus-visible:ring-ring',
                                done
                                    ? 'bg-success'
                                    : index === active
                                      ? 'scale-110 bg-grad-hangat motion-reduce:scale-100'
                                      : 'bg-text-muted',
                            )}
                        >
                            {index + 1}
                        </button>
                    );
                })}
            </div>

            <div
                aria-live="polite"
                className="flex flex-col gap-2 rounded-[20px] border border-border bg-surface p-4"
            >
                <span className="flex items-baseline justify-between gap-2">
                    <span className="text-[14px] font-bold text-text-muted">
                        Komentar {active + 1} dari {flow.comments.length}
                    </span>
                    <span className="text-[14px] text-text-muted">
                        {comment.author}
                    </span>
                </span>
                <span className="text-[16px] leading-6">{comment.text}</span>
                <Button
                    variant={isResolved ? 'tonal' : 'outline'}
                    size="sm"
                    className={cn(
                        'h-11 w-fit md:h-9',
                        isResolved && 'text-success',
                    )}
                    aria-pressed={isResolved}
                    onClick={toggleResolved}
                >
                    {isResolved && <Check aria-hidden />}
                    {isResolved ? 'Selesai' : 'Tandai selesai'}
                </Button>
            </div>
        </FlowSurface>
    );
}
