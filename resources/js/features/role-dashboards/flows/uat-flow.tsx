import { Check, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { UAT_FLOW } from '../fixtures';
import { uatTally } from '../lib';
import type { FlowProps } from './surface';
import { FlowLabel, FlowSurface } from './surface';

/** Analis "Jalankan UAT" (PAnalisUAT): tick steps, mark pass/fail, next. */
export function UatFlowSheet(props: FlowProps) {
    const flow = UAT_FLOW;
    const [index, setIndex] = useState(0);
    const [passed, setPassed] = useState(flow.passed);
    const [failed, setFailed] = useState(flow.failed);
    const [checked, setChecked] = useState<number[]>([]);
    const tally = uatTally(passed, failed, flow.total);
    const scenario = flow.scenarios[index % flow.scenarios.length];

    const record = (pass: boolean) => {
        if (pass) {
            setPassed((value) => value + 1);
        } else {
            setFailed((value) => value + 1);
        }

        toast.success(
            pass
                ? `Skenario ${tally.next} lulus`
                : `Skenario ${tally.next} gagal · temuan QA dibuat`,
        );
        setIndex((value) => value + 1);
        setChecked([]);
    };

    return (
        <FlowSurface
            {...props}
            title={flow.title}
            description={flow.meta}
            footer={
                <div className="grid grid-cols-2 gap-2">
                    <Button
                        variant="outline"
                        size="lg"
                        className="font-bold text-danger"
                        disabled={tally.finished}
                        onClick={() => record(false)}
                    >
                        <X aria-hidden />
                        Gagal
                    </Button>
                    <Button
                        size="lg"
                        disabled={tally.finished}
                        onClick={() => record(true)}
                    >
                        <Check aria-hidden />
                        Lulus
                    </Button>
                </div>
            }
        >
            <div className="flex flex-col gap-2" aria-live="polite">
                <span className="flex items-baseline justify-between">
                    <span className="text-[15px] font-bold">
                        Skenario dijalankan
                    </span>
                    <span className="text-[15px] font-bold tnum">
                        {tally.done}/{flow.total}
                    </span>
                </span>
                <Progress
                    value={tally.percent}
                    marker={flow.target}
                    markerLabel="target"
                    label="Skenario UAT dijalankan"
                />
                <span className="flex flex-wrap gap-x-4 gap-y-1 text-[14px]">
                    <span className="font-bold text-success">
                        {passed} lulus
                    </span>
                    <span className="font-bold text-danger">
                        {failed} gagal
                    </span>
                    <span className="text-text-muted">
                        target {flow.target}% sebelum go-live
                    </span>
                </span>
            </div>

            <section className="flex flex-col gap-3 rounded-[20px] border border-border bg-surface p-4">
                <FlowLabel>Skenario {tally.next}</FlowLabel>
                <span className="text-[18px] leading-[26px] font-bold">
                    {scenario.title}
                </span>
                <ul className="flex flex-col gap-1">
                    {scenario.steps.map((step, stepIndex) => {
                        const id = `uat-${index}-${stepIndex}`;
                        const on = checked.includes(stepIndex);

                        return (
                            <li key={step}>
                                <label
                                    htmlFor={id}
                                    className={cn(
                                        'flex min-h-12 cursor-pointer items-center gap-3 rounded-control px-2 transition-colors duration-120 ease-brand hover:bg-surface-2',
                                        on && 'text-text-muted line-through',
                                    )}
                                >
                                    <Checkbox
                                        id={id}
                                        checked={on}
                                        onCheckedChange={() =>
                                            setChecked((current) =>
                                                current.includes(stepIndex)
                                                    ? current.filter(
                                                          (value) =>
                                                              value !==
                                                              stepIndex,
                                                      )
                                                    : [...current, stepIndex],
                                            )
                                        }
                                    />
                                    <span className="text-[15px] leading-[22px]">
                                        {step}
                                    </span>
                                </label>
                            </li>
                        );
                    })}
                </ul>
                <p className="rounded-control bg-info-soft p-3 text-[14px] leading-5 text-info">
                    <b>Hasil yang diharapkan:</b> {scenario.expected}
                </p>
            </section>
        </FlowSurface>
    );
}
