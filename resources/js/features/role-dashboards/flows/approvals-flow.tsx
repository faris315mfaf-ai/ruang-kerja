import { Check, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { APPROVAL_ITEMS } from '../fixtures';
import type { Verdict } from '../lib';
import { pendingCount, TAG_CLASSES } from '../lib';
import type { FlowProps } from './surface';
import { FlowSurface } from './surface';

/** Direktur "Setujui" (PDirekturSetuju): approve/reject a queue, undoable. */
export function ApprovalsFlowSheet(props: FlowProps) {
    const [verdicts, setVerdicts] = useState<
        Record<string, Verdict | undefined>
    >({});
    const left = pendingCount(
        APPROVAL_ITEMS.map((item) => item.id),
        verdicts,
    );

    const decide = (
        id: string,
        title: string,
        verdict: Verdict | undefined,
    ) => {
        setVerdicts((current) => ({ ...current, [id]: verdict }));

        if (verdict) {
            toast.success(
                verdict === 'approved'
                    ? `${title} disetujui`
                    : `${title} ditolak`,
                {
                    action: {
                        label: 'Urungkan',
                        onClick: () =>
                            setVerdicts((current) => ({
                                ...current,
                                [id]: undefined,
                            })),
                    },
                },
            );
        }
    };

    return (
        <FlowSurface
            {...props}
            title="Persetujuan"
            description={
                props.mobile
                    ? 'Ketuk Setujui atau Tolak pada tiap item.'
                    : 'Setujui atau tolak tiap item. Keputusan bisa diurungkan.'
            }
            footer={
                <div className="flex items-center justify-between gap-3">
                    <Badge
                        variant="status"
                        tone={left ? 'warning' : 'success'}
                        dot
                        role="status"
                    >
                        {left ? `${left} menunggu` : 'Semua sudah diputus'}
                    </Badge>
                    <Button
                        variant="outline"
                        onClick={() => props.onOpenChange(false)}
                    >
                        Selesai
                    </Button>
                </div>
            }
        >
            <ul className="flex flex-col gap-3">
                {APPROVAL_ITEMS.map((item) => {
                    const verdict = verdicts[item.id];

                    return (
                        <li
                            key={item.id}
                            className={cn(
                                'flex flex-col gap-3 rounded-[20px] border border-border p-4 transition-colors duration-180 ease-brand',
                                verdict === 'approved' && 'bg-success-soft',
                                verdict === 'rejected' && 'bg-danger-soft',
                                !verdict && 'bg-surface',
                            )}
                        >
                            <div className="flex items-start gap-3">
                                <span
                                    className={cn(
                                        'flex size-11 shrink-0 items-center justify-center rounded-[14px] text-[13px] font-extrabold',
                                        TAG_CLASSES[item.tone],
                                    )}
                                >
                                    {item.tag}
                                </span>
                                <span className="flex min-w-0 flex-col gap-0.5">
                                    <span className="text-[16px] font-bold text-text">
                                        {item.title}
                                    </span>
                                    <span className="text-[14px] leading-5 text-text-muted">
                                        {item.meta}
                                    </span>
                                </span>
                            </div>
                            {verdict ? (
                                <div className="flex items-center justify-between gap-2">
                                    <span
                                        className={cn(
                                            'inline-flex items-center gap-1.5 text-[15px] font-bold',
                                            verdict === 'approved'
                                                ? 'text-success'
                                                : 'text-danger',
                                        )}
                                    >
                                        {verdict === 'approved' ? (
                                            <Check
                                                aria-hidden
                                                className="size-4"
                                            />
                                        ) : (
                                            <X aria-hidden className="size-4" />
                                        )}
                                        {verdict === 'approved'
                                            ? 'Disetujui · pengaju diberi tahu'
                                            : 'Ditolak · minta alasan dari pengaju'}
                                    </span>
                                    <Button
                                        variant="quiet"
                                        size="sm"
                                        className="h-11 md:h-9"
                                        onClick={() =>
                                            decide(
                                                item.id,
                                                item.title,
                                                undefined,
                                            )
                                        }
                                    >
                                        Urungkan
                                    </Button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-2">
                                    <Button
                                        variant="outline"
                                        className="font-bold text-danger"
                                        onClick={() =>
                                            decide(
                                                item.id,
                                                item.title,
                                                'rejected',
                                            )
                                        }
                                        aria-label={`Tolak ${item.title}`}
                                    >
                                        Tolak
                                    </Button>
                                    <Button
                                        onClick={() =>
                                            decide(
                                                item.id,
                                                item.title,
                                                'approved',
                                            )
                                        }
                                        aria-label={`Setujui ${item.title}`}
                                    >
                                        Setujui
                                    </Button>
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
        </FlowSurface>
    );
}
