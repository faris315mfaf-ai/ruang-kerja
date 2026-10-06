import { Check } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useFakeMutation } from '@/features/prototype/use-fake-mutation';
import { cn } from '@/lib/utils';
import { BUG_FLOW } from '../fixtures';
import { nextBugStep } from '../lib';
import type { FlowProps } from './surface';
import { FlowLabel, FlowSurface } from './surface';

/** Programming "Bug kritis" (PProgBug): walk SIM-388 through its steps. */
export function BugFlowSheet(props: FlowProps) {
    const flow = BUG_FLOW;
    const [step, setStep] = useState(flow.start);
    const { processing, run } = useFakeMutation();
    const last = flow.steps.length - 1;
    const finished = step >= last;

    const advance = () =>
        void run(
            () => setStep((current) => nextBugStep(current, flow.steps.length)),
            {
                success: finished ? undefined : flow.footers[step],
                delay: 450,
            },
        );

    return (
        <FlowSurface
            {...props}
            title={flow.title}
            description={`${flow.key} · bug produksi`}
            footer={
                <div className="flex flex-col gap-2">
                    <Button
                        size="lg"
                        className="w-full"
                        disabled={processing}
                        onClick={advance}
                    >
                        {processing ? (
                            <Spinner />
                        ) : finished ? (
                            <Check aria-hidden />
                        ) : null}
                        {finished
                            ? 'Selesai · ulangi pratinjau'
                            : flow.buttons[step]}
                    </Button>
                    <p
                        role="status"
                        className="text-center text-[14px] text-text-muted"
                    >
                        {flow.footers[step]}
                    </p>
                </div>
            }
        >
            <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[15px] font-semibold text-text-muted">
                    {flow.key}
                </span>
                <Badge variant="status" tone="danger" dot>
                    {flow.severity}
                </Badge>
            </div>

            <section className="flex flex-col gap-1 rounded-[20px] border border-border bg-surface p-4">
                <FlowLabel>Progres</FlowLabel>
                <ol className="mt-2 flex flex-col">
                    {flow.steps.map((item, index) => {
                        const done =
                            index < step || (finished && index === last);
                        const current = index === step && !finished;

                        return (
                            <li
                                key={item.title}
                                aria-current={current ? 'step' : undefined}
                                className="flex gap-3"
                            >
                                <span className="flex flex-col items-center">
                                    <span
                                        className={cn(
                                            'flex size-7 shrink-0 items-center justify-center rounded-full',
                                            done &&
                                                'bg-grad-aksi text-on-brand',
                                            current &&
                                                'border-4 border-accent-blue-strong bg-surface',
                                            !done &&
                                                !current &&
                                                'border-2 border-border-strong bg-surface',
                                        )}
                                    >
                                        {done && (
                                            <Check
                                                aria-hidden
                                                className="size-4"
                                                strokeWidth={3}
                                            />
                                        )}
                                    </span>
                                    {index < last && (
                                        <span
                                            aria-hidden
                                            className={cn(
                                                'my-1 w-0.5 flex-1 rounded-full',
                                                done
                                                    ? 'bg-accent-blue-strong'
                                                    : 'bg-border',
                                            )}
                                        />
                                    )}
                                </span>
                                <span className="flex min-h-14 flex-col pb-3">
                                    <span
                                        className={cn(
                                            'text-[16px] font-bold',
                                            current && 'text-info',
                                        )}
                                    >
                                        {item.title}
                                        <span className="sr-only">
                                            {done
                                                ? ' (selesai)'
                                                : current
                                                  ? ' (sekarang)'
                                                  : ''}
                                        </span>
                                    </span>
                                    <span className="text-[14px] text-text-muted">
                                        {item.meta}
                                    </span>
                                </span>
                            </li>
                        );
                    })}
                </ol>
            </section>

            <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-[20px] border border-border bg-divider sm:grid-cols-3">
                {flow.facts.map((fact) => (
                    <div
                        key={fact.label}
                        className="flex flex-col gap-0.5 bg-surface p-4"
                    >
                        <dt className="text-[14px] text-text-muted">
                            {fact.label}
                        </dt>
                        <dd
                            className={cn(
                                'text-[15px] font-bold',
                                fact.danger && 'text-danger',
                            )}
                        >
                            {fact.value}
                        </dd>
                    </div>
                ))}
            </dl>
        </FlowSurface>
    );
}
