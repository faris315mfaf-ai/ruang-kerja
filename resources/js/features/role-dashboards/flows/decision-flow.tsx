import { Link } from '@inertiajs/react';
import { CheckCircle2 } from 'lucide-react';
import { useId, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { formatPercent, formatRelative } from '@/lib/format';
import { formatShortDate } from '@/lib/requests';
import { cn, focusRing } from '@/lib/utils';
import { requestUpdate, resolve } from '@/routes/roles/decisions';
import { progressTone, withoutHidden } from '../lib';
import type { DecisionFlowData, DecisionItem, RoleKey } from '../types';
import { submitFlowAction } from './submit';
import type { FlowProps } from './surface';
import { FlowLabel, FlowSurface } from './surface';

const HEALTH_TONE = {
    on_track: 'success',
    at_risk: 'warning',
    off_track: 'danger',
} as const;

/**
 * Dirut "Putuskan" (PDirutKeputusan): an open decision from a PIC update with
 * the project's progress; the Direktur Utama writes the decision (sent to the
 * PIC as a direction) and closes it, or asks for a fresh update.
 */
export function DecisionFlowSheet({
    role,
    data,
    selectedId,
    onSelect,
    ...props
}: FlowProps & {
    role: RoleKey;
    data: DecisionFlowData;
    selectedId: string | null;
    onSelect: (id: string) => void;
}) {
    const textId = useId();
    const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
    const [text, setText] = useState('');
    const [busy, setBusy] = useState<'resolve' | 'update' | null>(null);
    const items = withoutHidden(data.items, hidden);
    const item = items.find((entry) => entry.id === selectedId) ?? items[0];

    const hide = (id: string, value: boolean) =>
        setHidden((current) => {
            const next = new Set(current);

            if (value) {
                next.add(id);
            } else {
                next.delete(id);
            }

            return next;
        });

    const decide = (target: DecisionItem) => {
        hide(target.id, true);
        submitFlowAction(
            resolve.url({ role, projectUpdate: target.id }),
            { decision: text.trim() === '' ? null : text.trim() },
            {
                failure: 'Keputusan gagal disimpan.',
                onStart: () => setBusy('resolve'),
                onSuccess: () => setText(''),
                onFailure: () => hide(target.id, false),
                onFinish: () => setBusy(null),
            },
        );
    };

    const askUpdate = (target: DecisionItem) =>
        submitFlowAction(
            requestUpdate.url({ role, projectUpdate: target.id }),
            { note: null },
            {
                failure: 'Permintaan update gagal dikirim.',
                onStart: () => setBusy('update'),
                onFinish: () => setBusy(null),
            },
        );

    return (
        <FlowSurface
            {...props}
            title="Butuh keputusan Anda"
            description={
                items.length > 0
                    ? `${items.length} keputusan menunggu · dari update PIC proyek`
                    : 'Semua keputusan sudah ditangani.'
            }
            footer={
                item ? (
                    <div className="flex flex-col gap-2">
                        <div className="grid grid-cols-[1fr_2fr] gap-2">
                            <Button
                                variant="outline"
                                size="lg"
                                disabled={busy !== null || !item.can_resolve}
                                onClick={() => askUpdate(item)}
                            >
                                {busy === 'update' && <Spinner />}
                                Minta update
                            </Button>
                            <Button
                                size="lg"
                                disabled={busy !== null || !item.can_resolve}
                                onClick={() => decide(item)}
                            >
                                {busy === 'resolve' && <Spinner />}
                                Putuskan
                            </Button>
                        </div>
                        <p className="text-center text-[14px] leading-5 text-text-muted">
                            {item.can_resolve
                                ? 'Keputusan dikirim ke PIC dan ditandai selesai.'
                                : 'Hanya Direksi yang bisa memutuskan.'}
                        </p>
                    </div>
                ) : undefined
            }
        >
            {!item ? (
                <EmptyState
                    size="sm"
                    icon={CheckCircle2}
                    title="Tidak ada keputusan yang menunggu"
                >
                    Permintaan keputusan dari update PIC muncul di sini.
                </EmptyState>
            ) : (
                <>
                    {items.length > 1 && (
                        <div
                            role="radiogroup"
                            aria-label="Pilih keputusan"
                            className="flex flex-wrap gap-2"
                        >
                            {items.map((entry) => (
                                <button
                                    key={entry.id}
                                    type="button"
                                    role="radio"
                                    aria-checked={entry.id === item.id}
                                    onClick={() => onSelect(entry.id)}
                                    className={cn(
                                        'inline-flex h-11 items-center rounded-full border px-4 text-[15px] font-bold transition-colors duration-120 ease-brand',
                                        entry.id === item.id
                                            ? 'border-transparent bg-grad-aksi text-on-brand'
                                            : 'border-border bg-surface text-text hover:bg-surface-2',
                                        focusRing,
                                    )}
                                >
                                    {entry.project.key}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="flex flex-col gap-3 rounded-[20px] border border-border bg-surface p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <Link
                                href={item.project.url}
                                className={cn(
                                    'rounded-sm text-[16px] font-bold text-link hover:underline',
                                    focusRing,
                                )}
                            >
                                {item.project.key} · {item.project.name}
                            </Link>
                            {item.project.health && (
                                <Badge
                                    variant="status"
                                    dot
                                    tone={HEALTH_TONE[item.project.health]}
                                >
                                    {item.project.health_label}
                                </Badge>
                            )}
                        </div>
                        <span className="text-[15px] text-text-muted">
                            Diajukan{' '}
                            <b className="font-bold text-text">
                                {item.author?.name ?? 'PIC'}
                            </b>{' '}
                            · {formatRelative(item.created_at)}
                        </span>
                        <span className="flex items-baseline gap-2">
                            <span
                                className={cn(
                                    'text-[32px] leading-9 font-extrabold tnum',
                                    progressTone(
                                        item.project.actual,
                                        item.project.planned,
                                    ) === 'danger' && 'text-danger',
                                )}
                            >
                                {formatPercent(item.project.actual ?? 0, 0)}
                            </span>
                            <span className="text-[15px] text-text-muted">
                                progres
                                {item.project.planned !== null &&
                                    ` · rencana ${formatPercent(item.project.planned, 0)}`}
                                {item.project.target_date &&
                                    ` · target ${formatShortDate(item.project.target_date)}`}
                            </span>
                        </span>
                        <Progress
                            value={item.project.actual ?? 0}
                            marker={item.project.planned ?? undefined}
                            tone={progressTone(
                                item.project.actual,
                                item.project.planned,
                            )}
                            label={`Progres ${item.project.key}`}
                        />
                    </div>

                    <section className="flex flex-col gap-2">
                        <FlowLabel>Keputusan yang diminta</FlowLabel>
                        <p className="text-[18px] leading-7 font-bold text-text">
                            {item.decision}
                        </p>
                        <p className="text-[15px] leading-[22px] text-text-muted">
                            {item.summary}
                        </p>
                        {item.blockers && (
                            <p className="rounded-control bg-warning-soft px-3 py-2 text-[15px] leading-[22px] text-warning">
                                Hambatan: {item.blockers}
                            </p>
                        )}
                    </section>

                    <div className="flex flex-col gap-2">
                        <Label htmlFor={textId}>
                            Keputusan Anda{' '}
                            <span className="font-normal text-text-muted">
                                (opsional)
                            </span>
                        </Label>
                        <Textarea
                            id={textId}
                            value={text}
                            maxLength={2000}
                            rows={3}
                            className="min-h-24 text-[17px] md:text-[16px]"
                            placeholder="Mis. Setuju perpanjangan 3 minggu, laporkan kemajuan API tiap Jumat."
                            disabled={!item.can_resolve}
                            onChange={(event) => setText(event.target.value)}
                        />
                        <p className="text-[14px] text-text-muted">
                            Dikirim ke PIC sebagai arahan pada update ini.
                        </p>
                    </div>
                </>
            )}
        </FlowSurface>
    );
}
