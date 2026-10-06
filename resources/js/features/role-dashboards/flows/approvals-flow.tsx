import { Link } from '@inertiajs/react';
import { CheckCircle2 } from 'lucide-react';
import { useId, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { CategoryTile } from '@/features/requests/badges';
import {
    formatRequestPeriod,
    formatRequestTitle,
    stepProgress,
} from '@/lib/requests';
import { cn, focusRing } from '@/lib/utils';
import { approve, reject } from '@/routes/roles/approvals';
import type { RequestItem } from '@/types/requests';
import { withoutHidden } from '../lib';
import type { ApprovalsFlowData, RoleKey } from '../types';
import { submitFlowAction } from './submit';
import type { FlowProps } from './surface';
import { FlowSurface } from './surface';

/**
 * Direktur "Setujui" (PDirekturSetuju): the viewer's approval queue, decided
 * item by item with the Fase 1 actions (ApproveStep / RejectStep). A decided
 * item leaves the list at once and comes back if the server refuses.
 * Decisions are final (no undo): the requester is notified immediately.
 */
export function ApprovalsFlowSheet({
    role,
    data,
    ...props
}: FlowProps & { role: RoleKey; data: ApprovalsFlowData }) {
    const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
    const items = withoutHidden(data.items, hidden);
    const left = Math.max(0, data.total - hidden.size);

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

    return (
        <FlowSurface
            {...props}
            title="Persetujuan"
            description={
                props.mobile
                    ? 'Setujui atau tolak tiap pengajuan.'
                    : 'Setujui atau tolak tiap pengajuan. Pemohon langsung diberi tahu.'
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
            {items.length === 0 ? (
                <EmptyState
                    size="sm"
                    icon={CheckCircle2}
                    title="Tidak ada yang menunggu"
                >
                    Pengajuan baru yang perlu keputusan Anda muncul di sini.
                </EmptyState>
            ) : (
                <ul className="flex flex-col gap-3">
                    {items.map((item) => (
                        <ApprovalCard
                            key={item.id}
                            role={role}
                            item={item}
                            onHide={(value) => hide(item.id, value)}
                        />
                    ))}
                </ul>
            )}
            {data.total > data.items.length && (
                <Link
                    href="/persetujuan"
                    className={cn(
                        'self-start rounded-sm text-[15px] font-bold text-link hover:underline',
                        focusRing,
                    )}
                >
                    {data.total - data.items.length} lainnya di Persetujuan
                </Link>
            )}
        </FlowSurface>
    );
}

function ApprovalCard({
    role,
    item,
    onHide,
}: {
    role: RoleKey;
    item: RequestItem;
    onHide: (hidden: boolean) => void;
}) {
    const reasonId = useId();
    const [rejecting, setRejecting] = useState(false);
    const [reason, setReason] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const title = formatRequestTitle(item);
    const step = stepProgress(item);

    const send = (kind: 'approve' | 'reject') => {
        if (kind === 'reject' && reason.trim() === '') {
            setError('Alasan wajib diisi saat menolak.');

            return;
        }

        const route = kind === 'approve' ? approve : reject;
        onHide(true);
        submitFlowAction(
            route.url({ role, employeeRequest: item.id }),
            { note: kind === 'reject' ? reason.trim() : null },
            {
                failure:
                    kind === 'approve'
                        ? 'Pengajuan gagal disetujui.'
                        : 'Pengajuan gagal ditolak.',
                onStart: () => setBusy(true),
                onFailure: () => onHide(false),
                onFinish: () => setBusy(false),
            },
        );
    };

    return (
        <li className="flex flex-col gap-3 rounded-[20px] border border-border bg-surface p-4">
            <div className="flex items-start gap-3">
                <CategoryTile category={item.type.category} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[16px] font-bold text-text">
                        {title}
                    </span>
                    <span className="text-[14px] leading-5 text-text-muted">
                        {item.user.name}
                        {item.user.position ? ` · ${item.user.position}` : ''}
                    </span>
                    <span className="text-[14px] leading-5 text-text-muted">
                        {formatRequestPeriod(item)}
                        {step ? ` · langkah ${step}` : ''}
                    </span>
                </span>
                <Link
                    href={`/persetujuan/${item.id}`}
                    className={cn(
                        'inline-flex h-11 shrink-0 items-center rounded-control px-2 text-[14px] font-bold text-link hover:underline',
                        focusRing,
                    )}
                    aria-label={`Detail ${title} ${item.user.name}`}
                >
                    Detail
                </Link>
            </div>

            {rejecting && (
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor={reasonId}>Alasan penolakan</Label>
                    <Textarea
                        id={reasonId}
                        value={reason}
                        autoFocus
                        rows={2}
                        maxLength={1000}
                        className="min-h-20 text-[17px] md:text-[16px]"
                        aria-invalid={error ? true : undefined}
                        aria-describedby={`${reasonId}-hint`}
                        onChange={(event) => {
                            setReason(event.target.value);
                            setError(null);
                        }}
                    />
                    <p
                        id={`${reasonId}-hint`}
                        className={cn(
                            'text-[14px]',
                            error ? 'text-danger' : 'text-text-muted',
                        )}
                    >
                        {error ?? `Dikirim ke ${item.user.name.split(' ')[0]}.`}
                    </p>
                </div>
            )}

            <div className="grid grid-cols-2 gap-2">
                {rejecting ? (
                    <Button
                        variant="quiet"
                        disabled={busy}
                        onClick={() => {
                            setRejecting(false);
                            setError(null);
                        }}
                    >
                        Batal
                    </Button>
                ) : (
                    <Button
                        variant="outline"
                        className="font-bold text-danger"
                        disabled={busy}
                        onClick={() => setRejecting(true)}
                        aria-label={`Tolak ${title} ${item.user.name}`}
                    >
                        Tolak
                    </Button>
                )}
                {rejecting ? (
                    <Button
                        variant="destructive"
                        disabled={busy}
                        onClick={() => send('reject')}
                    >
                        {busy && <Spinner />}
                        Kirim penolakan
                    </Button>
                ) : (
                    <Button
                        disabled={busy}
                        onClick={() => send('approve')}
                        aria-label={`Setujui ${title} ${item.user.name}`}
                    >
                        {busy && <Spinner />}
                        Setujui
                    </Button>
                )}
            </div>
        </li>
    );
}
