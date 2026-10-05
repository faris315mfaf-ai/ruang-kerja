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
                className={cn('min-h-24', mobile && 'min-h-28 text-[17px]')}
                placeholder="Wajib diisi bila menolak atau meminta revisi"
                value={form.data.note}
                onChange={(event) => {
                    form.setData('note', event.target.value);
                    form.clearErrors('note');
                }}
            />
            <p className="text-meta text-text-muted">
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

    if (mobile) {
        return (
            <div className="flex items-center gap-2.5">
                <Button
                    type="button"
                    variant="quiet"
                    size="lg"
                    className="px-3"
                    disabled={form.processing}
                    onClick={() => decide('revise')}
                >
                    Revisi
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="flex-1 font-bold text-danger hover:text-danger"
                    disabled={form.processing}
                    onClick={() => decide('reject')}
                >
                    Tolak
                </Button>
                <Button
                    type="button"
                    size="lg"
                    className="flex-[1.4]"
                    disabled={form.processing}
                    onClick={() => decide('approve')}
                >
                    Setujui
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-wrap items-center gap-3">
            <Button
                type="button"
                variant="outline"
                className="h-12 px-5 font-bold text-danger hover:text-danger"
                disabled={form.processing}
                onClick={() => decide('reject')}
            >
                Tolak
            </Button>
            <Button
                type="button"
                variant="outline"
                className="h-12 px-5"
                disabled={form.processing}
                onClick={() => decide('revise')}
            >
                Minta revisi
            </Button>
            <span className="flex-1" />
            <Button
                type="button"
                className="h-12 px-7 text-[17px]"
                disabled={form.processing}
                onClick={() => decide('approve')}
            >
                Setujui
            </Button>
        </div>
    );
}
