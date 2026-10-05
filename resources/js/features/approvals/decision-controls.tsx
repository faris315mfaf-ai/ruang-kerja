import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { useDecision } from './use-decision';

type Decision = ReturnType<typeof useDecision>;

export function DecisionNote({
    decision,
    requesterName,
    mobile = false,
}: {
    decision: Decision;
    requesterName: string;
    mobile?: boolean;
}) {
    const { form } = decision;

    return (
        <div className="grid gap-2">
            <Label htmlFor="decision-note">
                Catatan untuk pemohon{' '}
                <span className="font-normal text-text-muted">
                    (opsional bila menyetujui)
                </span>
            </Label>
            <Textarea
                id="decision-note"
                rows={3}
                maxLength={1000}
                className={cn(mobile && 'min-h-28 text-base')}
                placeholder="Wajib diisi bila menolak atau meminta revisi"
                value={form.data.note}
                onChange={(event) => {
                    form.setData('note', event.target.value);
                    form.clearErrors('note');
                }}
            />
            <p className="text-[13px] text-text-muted">
                Terlihat oleh {requesterName.split(' ')[0]} dan HR.
            </p>
            <InputError message={form.errors.note} />
        </div>
    );
}

export function DecisionButtons({
    decision,
    mobile = false,
}: {
    decision: Decision;
    mobile?: boolean;
}) {
    const { form, decide } = decision;

    return (
        <div className={cn('flex items-center gap-2', mobile && 'gap-3')}>
            <Button
                type="button"
                variant={mobile ? 'ghost' : 'outline'}
                className={cn(mobile && 'h-12 px-3 text-base')}
                disabled={form.processing}
                onClick={() => decide('revise')}
            >
                Minta revisi
            </Button>
            <span className="flex-1" />
            <Button
                type="button"
                variant="outline"
                className={cn(
                    'text-danger hover:text-danger',
                    mobile && 'h-12 flex-1 text-base',
                )}
                disabled={form.processing}
                onClick={() => decide('reject')}
            >
                Tolak
            </Button>
            <Button
                type="button"
                className={cn(mobile && 'h-12 flex-[1.3] text-base')}
                disabled={form.processing}
                onClick={() => decide('approve')}
            >
                Setujui
            </Button>
        </div>
    );
}
