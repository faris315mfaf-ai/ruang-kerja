import { Camera, Check, ImageIcon, Phone } from 'lucide-react';
import { useId, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useFakeMutation } from '@/features/prototype/use-fake-mutation';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { TICKET_FLOW } from '../fixtures';
import type { FlowProps } from './surface';
import { FlowLabel, FlowSurface } from './surface';

/** Implementer "Tiket klien" (PImplTiket): status, photos, timeline, save. */
export function TicketFlowSheet(props: FlowProps) {
    const flow = TICKET_FLOW;
    const name = useId();
    const statusId = useId();
    const [status, setStatus] = useState(flow.start);
    const [savedStatus, setSavedStatus] = useState(flow.start);
    const [photos, setPhotos] = useState(flow.photos);
    const [savedPhotos, setSavedPhotos] = useState(flow.photos.length);
    const [log, setLog] = useState(flow.log);
    const { processing, run } = useFakeMutation();
    const dirty = status !== savedStatus || photos.length !== savedPhotos;

    const save = () =>
        void run(
            () => {
                setLog((current) => [
                    ...current,
                    {
                        time: formatTime(new Date()),
                        text: `Status diubah ke “${flow.statuses[status]}” oleh Bayu`,
                    },
                ]);
                setSavedStatus(status);
                setSavedPhotos(photos.length);
            },
            { success: 'Tiket tersimpan · klien diberi tahu' },
        );

    return (
        <FlowSurface
            {...props}
            title={flow.title}
            description={flow.meta}
            footer={
                <div className="flex gap-2">
                    <Button
                        asChild
                        variant="outline"
                        size="icon-lg"
                        aria-label="Telepon PIC klien"
                    >
                        <a href="tel:+620000000000">
                            <Phone aria-hidden />
                        </a>
                    </Button>
                    <Button
                        size="lg"
                        className="flex-1"
                        disabled={processing || !dirty}
                        onClick={save}
                    >
                        {processing ? (
                            <Spinner />
                        ) : !dirty ? (
                            <Check aria-hidden />
                        ) : null}
                        {dirty
                            ? 'Simpan update'
                            : 'Tersimpan · klien diberi tahu'}
                    </Button>
                </div>
            }
        >
            <div className="flex flex-wrap items-center gap-2">
                <Badge variant="status" tone="danger" dot>
                    {flow.priority}
                </Badge>
                <span className="font-mono text-[15px] font-semibold text-text-muted">
                    {flow.number}
                </span>
            </div>

            <FlowLabel id={statusId}>Status</FlowLabel>
            <div
                role="radiogroup"
                aria-labelledby={statusId}
                className="grid grid-cols-2 gap-2"
            >
                {flow.statuses.map((label, index) => (
                    <label
                        key={label}
                        className={cn(
                            'flex min-h-12 cursor-pointer items-center justify-center rounded-control border border-border bg-surface px-3 text-center text-[15px] font-bold transition-colors duration-120 ease-brand',
                            'has-checked:border-2 has-checked:border-primary has-checked:bg-link-soft has-checked:text-link',
                            'has-focus-visible:ring-[3px] has-focus-visible:ring-ring',
                        )}
                    >
                        <input
                            type="radio"
                            name={name}
                            className="sr-only"
                            checked={status === index}
                            onChange={() => setStatus(index)}
                        />
                        {label}
                    </label>
                ))}
            </div>

            <ul aria-label="Foto lampiran" className="flex flex-wrap gap-2">
                {photos.map((photo) => (
                    <li
                        key={photo}
                        className="flex h-20 w-24 flex-col items-center justify-center gap-1 rounded-lg border border-border bg-surface-2 text-[12px] font-semibold text-text-muted"
                    >
                        <ImageIcon aria-hidden className="size-5" />
                        {photo}
                    </li>
                ))}
                <li>
                    <button
                        type="button"
                        onClick={() =>
                            setPhotos((current) => [
                                ...current,
                                `foto_${current.length + 1}.jpg`,
                            ])
                        }
                        className="flex h-20 w-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border-strong bg-surface text-[13px] font-bold text-link outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
                    >
                        <Camera aria-hidden className="size-5" />
                        Foto
                    </button>
                </li>
            </ul>

            <section className="flex flex-col rounded-[20px] border border-border bg-surface p-4">
                <FlowLabel>Linimasa</FlowLabel>
                <ol className="mt-1 flex flex-col">
                    {log.map((entry, index) => (
                        <li
                            key={`${entry.time}-${index}`}
                            className="flex gap-3 border-t border-divider py-3 first:border-t-0"
                        >
                            <span className="w-12 shrink-0 font-mono text-[14px] font-semibold text-text-muted">
                                {entry.time}
                            </span>
                            <span className="text-[15px] leading-[22px]">
                                {entry.text}
                            </span>
                        </li>
                    ))}
                </ol>
            </section>
        </FlowSurface>
    );
}
