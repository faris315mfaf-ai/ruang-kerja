import { Check, FileText } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { useFakeMutation } from '@/features/prototype/use-fake-mutation';
import { cn } from '@/lib/utils';
import { DISPOSITION_FLOW } from '../fixtures';
import { toggleIndex } from '../lib';
import type { FlowProps } from './surface';
import { FlowLabel, FlowSurface } from './surface';

function ChipGroup({
    labelId,
    options,
    selected,
    onToggle,
}: {
    labelId: string;
    options: string[];
    selected: number[];
    onToggle: (index: number) => void;
}) {
    return (
        <div
            role="group"
            aria-labelledby={labelId}
            className="flex flex-wrap gap-2"
        >
            {options.map((option, index) => {
                const on = selected.includes(index);

                return (
                    <button
                        key={option}
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        onClick={() => onToggle(index)}
                        className={cn(
                            'inline-flex h-11 items-center gap-1.5 rounded-full border px-4 text-[15px] font-bold transition-colors duration-120 ease-brand outline-none focus-visible:ring-[3px] focus-visible:ring-ring',
                            on
                                ? 'border-2 border-primary bg-link-soft text-link'
                                : 'border-border bg-surface text-text hover:bg-surface-2',
                        )}
                    >
                        {on && (
                            <Check
                                aria-hidden
                                className="size-4"
                                strokeWidth={3}
                            />
                        )}
                        {option}
                    </button>
                );
            })}
        </div>
    );
}

/** Corsec "Disposisi surat" (PCorsecSurat): recipients, instructions, send. */
export function DispositionFlowSheet(props: FlowProps) {
    const flow = DISPOSITION_FLOW;
    const toId = useId();
    const insId = useId();
    const noteId = useId();
    const [recipients, setRecipients] = useState(flow.defaultRecipients);
    const [instructions, setInstructions] = useState(flow.defaultInstructions);
    const [note, setNote] = useState(flow.note);
    const [sent, setSent] = useState(false);
    const { processing, run } = useFakeMutation();

    const touch = () => setSent(false);
    const send = () =>
        void run(() => setSent(true), {
            success: `Disposisi terkirim ke ${recipients.length} tujuan`,
        });

    return (
        <FlowSurface
            {...props}
            title="Disposisi surat"
            description={flow.number}
            footer={
                <div className="flex flex-col gap-2">
                    <Button
                        size="lg"
                        className="w-full"
                        disabled={processing || sent || recipients.length === 0}
                        onClick={send}
                    >
                        {processing ? (
                            <Spinner />
                        ) : sent ? (
                            <Check aria-hidden />
                        ) : null}
                        {sent
                            ? 'Disposisi terkirim'
                            : recipients.length === 0
                              ? 'Pilih minimal 1 tujuan'
                              : `Kirim disposisi ke ${recipients.length} tujuan`}
                    </Button>
                    <p
                        role="status"
                        className="text-center text-[14px] text-text-muted"
                    >
                        {sent
                            ? 'Masuk ke inbox penerima · tugas dibuat otomatis'
                            : 'Penerima mendapat notifikasi dan salinan PDF'}
                    </p>
                </div>
            }
        >
            <div className="flex gap-4 rounded-[20px] border border-border bg-surface p-4">
                <span
                    aria-hidden
                    className="relative flex h-[104px] w-[80px] shrink-0 flex-col gap-1.5 rounded-[10px] border border-border bg-background p-2.5"
                >
                    <span className="h-1.5 w-3/4 rounded-full bg-border-strong" />
                    <span className="h-1.5 w-full rounded-full bg-border" />
                    <span className="h-1.5 w-full rounded-full bg-border" />
                    <span className="h-1.5 w-2/3 rounded-full bg-border" />
                    <span className="absolute right-1.5 bottom-1.5 inline-flex items-center gap-0.5 rounded-xs bg-danger-soft px-1 text-[11px] font-bold text-danger">
                        <FileText className="size-3" />
                        PDF
                    </span>
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                    <span className="text-[17px] leading-6 font-bold">
                        {flow.title}
                    </span>
                    <span className="text-[14px] text-text-muted">
                        {flow.received} · PDF 3 hlm
                    </span>
                    <span className="text-[14px] font-bold text-danger">
                        {flow.deadline}
                    </span>
                </span>
            </div>

            <FlowLabel id={toId}>Teruskan ke</FlowLabel>
            <ChipGroup
                labelId={toId}
                options={flow.recipients}
                selected={recipients}
                onToggle={(index) => {
                    setRecipients((current) => toggleIndex(current, index));
                    touch();
                }}
            />

            <FlowLabel id={insId}>Instruksi</FlowLabel>
            <ChipGroup
                labelId={insId}
                options={flow.instructions}
                selected={instructions}
                onToggle={(index) => {
                    setInstructions((current) => toggleIndex(current, index));
                    touch();
                }}
            />

            <div className="flex flex-col gap-2">
                <Label htmlFor={noteId}>Catatan disposisi</Label>
                <Textarea
                    id={noteId}
                    value={note}
                    rows={3}
                    onChange={(event) => {
                        setNote(event.target.value);
                        touch();
                    }}
                />
            </div>
        </FlowSurface>
    );
}
