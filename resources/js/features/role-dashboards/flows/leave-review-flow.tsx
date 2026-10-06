import { AlertTriangle, Check } from 'lucide-react';
import { useId, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { UserAvatar } from '@/components/shell/user-avatar';
import { useFakeMutation } from '@/features/prototype/use-fake-mutation';
import { cn } from '@/lib/utils';
import { LEAVE_REVIEW_FLOW } from '../fixtures';
import type { FlowProps } from './surface';
import { FlowSurface } from './surface';

const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

type Decision = 'approved' | 'rejected' | null;

/** HR "Tinjau cuti" (PHRCuti): calendar, checks, approve or reject with reason. */
export function LeaveReviewFlowSheet(props: FlowProps) {
    const flow = LEAVE_REVIEW_FLOW;
    const reasonId = useId();
    const [decision, setDecision] = useState<Decision>(null);
    const [rejecting, setRejecting] = useState(false);
    const [reason, setReason] = useState('');
    const [reasonError, setReasonError] = useState(false);
    const { processing, run } = useFakeMutation();

    const approve = () =>
        void run(() => setDecision('approved'), {
            success: 'Cuti Sari disetujui · saldo menjadi 5 hari',
        });

    const reject = () => {
        if (!rejecting) {
            setRejecting(true);

            return;
        }

        if (reason.trim().length < 5) {
            setReasonError(true);

            return;
        }

        void run(
            () => {
                setDecision('rejected');
                setRejecting(false);
            },
            { success: 'Cuti ditolak · Sari diberi tahu alasannya' },
        );
    };

    const chip =
        decision === 'approved'
            ? { tone: 'success' as const, text: 'Disetujui HR' }
            : decision === 'rejected'
              ? { tone: 'danger' as const, text: 'Ditolak' }
              : { tone: 'warning' as const, text: 'Menunggu HR' };

    return (
        <FlowSurface
            {...props}
            title="Tinjau cuti"
            description="Cuti tahunan · langkah 2 dari 2"
            footer={
                decision ? (
                    <Button
                        variant="outline"
                        size="lg"
                        className="w-full"
                        onClick={() => setDecision(null)}
                    >
                        Urungkan keputusan
                    </Button>
                ) : (
                    <div className="grid grid-cols-[1fr_2fr] gap-2">
                        <Button
                            variant="outline"
                            size="lg"
                            className="text-danger"
                            disabled={processing}
                            onClick={reject}
                        >
                            {rejecting ? 'Kirim penolakan' : 'Tolak'}
                        </Button>
                        <Button
                            size="lg"
                            disabled={processing}
                            onClick={approve}
                        >
                            {processing && <Spinner />}
                            Setujui cuti
                        </Button>
                    </div>
                )
            }
        >
            <div className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-3">
                    <UserAvatar
                        name={flow.employee}
                        className="size-12 text-[16px]"
                    />
                    <span className="flex min-w-0 flex-col">
                        <span className="text-[18px] font-bold text-text">
                            {flow.employee}
                        </span>
                        <span className="text-[15px] text-text-muted">
                            {flow.role}
                        </span>
                    </span>
                </span>
                <Badge variant="status" tone={chip.tone} dot role="status">
                    {chip.text}
                </Badge>
            </div>

            <section
                aria-label={`Kalender ${flow.month}`}
                className="flex flex-col gap-3 rounded-[20px] border border-border bg-surface p-4"
            >
                <span className="text-[16px] font-bold">{flow.month}</span>
                <div className="grid grid-cols-7 gap-1 text-center">
                    {WEEKDAYS.map((day) => (
                        <span
                            key={day}
                            className="text-[13px] font-bold text-text-muted"
                        >
                            {day}
                        </span>
                    ))}
                    {flow.days.map((iso, index) => {
                        const off = flow.leaveDays.includes(iso);
                        const weekend = index % 7 >= 5;
                        const day = Number(iso.slice(8));
                        const otherMonth = iso.slice(5, 7) !== '10';

                        return (
                            <span
                                key={iso}
                                aria-label={
                                    off ? `${day} Oktober, cuti` : undefined
                                }
                                className={cn(
                                    'flex h-10 items-center justify-center rounded-[10px] text-[15px] font-semibold tnum',
                                    off &&
                                        'bg-grad-aksi font-extrabold text-on-brand',
                                    !off &&
                                        iso === flow.highlight &&
                                        'bg-warning-soft text-warning',
                                    !off &&
                                        (weekend || otherMonth) &&
                                        'text-text-subtle',
                                )}
                            >
                                {day}
                            </span>
                        );
                    })}
                </div>
                <span className="text-[15px] text-text-muted">
                    {flow.range}
                </span>
            </section>

            <ul className="flex flex-col rounded-[20px] border border-border bg-surface px-4">
                {flow.checks.map((check) => (
                    <li
                        key={check.title}
                        className="flex items-start gap-3 border-t border-divider py-3 first:border-t-0"
                    >
                        <span
                            className={cn(
                                'flex size-8 shrink-0 items-center justify-center rounded-full',
                                check.ok
                                    ? 'bg-success-soft text-success'
                                    : 'bg-warning-soft text-warning',
                            )}
                        >
                            {check.ok ? (
                                <Check
                                    aria-label="Terpenuhi"
                                    className="size-4"
                                    strokeWidth={3}
                                />
                            ) : (
                                <AlertTriangle
                                    aria-label="Perlu perhatian"
                                    className="size-4"
                                />
                            )}
                        </span>
                        <span className="flex flex-col">
                            <span className="text-[16px] font-bold">
                                {check.title}
                            </span>
                            <span className="text-[14px] leading-5 text-text-muted">
                                {check.meta}
                            </span>
                        </span>
                    </li>
                ))}
            </ul>

            {rejecting && !decision && (
                <div className="flex flex-col gap-2">
                    <Label htmlFor={reasonId}>Alasan penolakan</Label>
                    <Textarea
                        id={reasonId}
                        value={reason}
                        autoFocus
                        aria-invalid={reasonError || undefined}
                        aria-describedby={`${reasonId}-hint`}
                        onChange={(event) => {
                            setReason(event.target.value);
                            setReasonError(false);
                        }}
                        placeholder="Mis. bertepatan dengan hypercare go-live SIMRS"
                    />
                    <p
                        id={`${reasonId}-hint`}
                        className={cn(
                            'text-[14px]',
                            reasonError ? 'text-danger' : 'text-text-muted',
                        )}
                    >
                        {reasonError
                            ? 'Tulis alasan minimal 5 karakter.'
                            : 'Alasan dikirim ke Sari dan atasannya.'}
                    </p>
                </div>
            )}
        </FlowSurface>
    );
}
