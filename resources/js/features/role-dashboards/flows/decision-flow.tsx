import { Check } from 'lucide-react';
import { useId, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { useFakeMutation } from '@/features/prototype/use-fake-mutation';
import { cn } from '@/lib/utils';
import { DECISION_FLOW } from '../fixtures';
import type { FlowProps } from './surface';
import { FlowLabel, FlowSurface } from './surface';

/** Dirut "Putuskan" (PDirutKeputusan): pick option A/B/C, send the decision. */
export function DecisionFlowSheet(props: FlowProps) {
    const flow = DECISION_FLOW;
    const name = useId();
    const labelId = useId();
    const [choice, setChoice] = useState(flow.options[0].id);
    const [sent, setSent] = useState<string | null>(null);
    const { processing, run } = useFakeMutation();

    const decide = () =>
        void run(() => setSent(choice), {
            success: `Keputusan opsi ${choice} terkirim`,
        });

    return (
        <FlowSurface
            {...props}
            title={flow.title}
            description={flow.position}
            footer={
                <div className="flex flex-col gap-2">
                    <Button
                        size="lg"
                        className="w-full"
                        disabled={processing || sent === choice}
                        onClick={decide}
                    >
                        {processing ? (
                            <Spinner />
                        ) : sent === choice ? (
                            <Check aria-hidden />
                        ) : null}
                        {sent === choice
                            ? 'Keputusan terkirim'
                            : `Putuskan opsi ${choice}`}
                    </Button>
                    <p
                        role="status"
                        className="text-center text-[14px] leading-5 text-text-muted"
                    >
                        {sent === choice
                            ? 'Agus dan Rina diberi tahu · tercatat di notulen rapat direksi'
                            : 'Keputusan dikirim ke pengaju dan PIC proyek'}
                    </p>
                </div>
            }
        >
            <div className="flex flex-col gap-3 rounded-[20px] border border-border bg-surface p-4">
                <span className="text-[15px] text-text-muted">
                    Diajukan{' '}
                    <b className="font-bold text-text">{flow.requester}</b> ·{' '}
                    {flow.submitted}
                </span>
                <span className="flex items-baseline gap-2">
                    <span className="text-[32px] leading-9 font-extrabold text-danger tnum">
                        {flow.actual}%
                    </span>
                    <span className="text-[15px] text-text-muted">
                        progres · rencana {flow.planned}%
                    </span>
                </span>
                <Progress
                    value={flow.actual}
                    marker={flow.planned}
                    tone="danger"
                    label="Progres proyek DEP"
                />
                <Badge
                    variant="status"
                    tone="danger"
                    className="h-auto min-h-8 rounded-control py-1.5 whitespace-normal"
                >
                    {flow.context}
                </Badge>
            </div>

            <FlowLabel id={labelId}>Pilih keputusan</FlowLabel>
            <div
                role="radiogroup"
                aria-labelledby={labelId}
                className="flex flex-col gap-2.5"
            >
                {flow.options.map((option) => (
                    <label
                        key={option.id}
                        className={cn(
                            'flex min-h-[72px] cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface p-4 transition-colors duration-120 ease-brand',
                            'has-checked:border-2 has-checked:border-accent-blue-strong has-checked:bg-info-soft',
                            'has-focus-visible:ring-[3px] has-focus-visible:ring-ring',
                        )}
                    >
                        <input
                            type="radio"
                            name={name}
                            value={option.id}
                            checked={choice === option.id}
                            onChange={() => setChoice(option.id)}
                            className="peer sr-only"
                        />
                        <span
                            aria-hidden
                            className="mt-0.5 size-6 shrink-0 rounded-full border-2 border-border-strong bg-surface peer-checked:border-[7px] peer-checked:border-accent-blue-strong"
                        />
                        <span className="flex min-w-0 flex-col gap-0.5">
                            <span className="text-[16px] font-bold text-text">
                                {option.title}
                            </span>
                            <span className="text-[14px] leading-5 text-text-muted">
                                {option.detail}
                            </span>
                        </span>
                    </label>
                ))}
            </div>
        </FlowSurface>
    );
}
