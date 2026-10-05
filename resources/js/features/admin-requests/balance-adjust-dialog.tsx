import { router, useForm } from '@inertiajs/react';
import { useEffect } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { formatDateTime } from '@/lib/format';
import { formatDays } from '@/lib/requests';
import { cn } from '@/lib/utils';
import { adjust } from '@/routes/admin/leave-balances';
import type { BalanceSummary, Person } from '@/types/requests';

export type BalanceHistory = {
    balance_id: string;
    items: {
        id: string;
        delta_days: number;
        reason: string;
        actor: string | null;
        created_at: string | null;
    }[];
} | null;

type Props = {
    user: Person;
    balance: BalanceSummary & { id: string };
    history: BalanceHistory | undefined;
    onClose: () => void;
};

const signed = (value: number) =>
    `${value > 0 ? '+' : '−'}${formatDays(Math.abs(value))}`;

/** "Penyesuaian": add or take back days with a mandatory reason; shows the ledger. */
export function BalanceAdjustDialog({
    user,
    balance,
    history,
    onClose,
}: Props) {
    const form = useForm({ delta_days: '', reason: '' });
    const loaded = history?.balance_id === balance.id ? history : null;

    useEffect(() => {
        router.reload({
            only: ['history'],
            data: { riwayat: balance.id },
        });
    }, [balance.id]);

    const delta = Number(form.data.delta_days.replace(',', '.'));
    const preview =
        form.data.delta_days !== '' && Number.isFinite(delta)
            ? balance.available + delta
            : null;

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Penyesuaian saldo {user.name}</DialogTitle>
                    <DialogDescription>
                        Tambah (+) atau kurangi (−) hari dengan alasan. Tercatat
                        di riwayat dan log audit. Saldo tidak bisa minus.
                    </DialogDescription>
                </DialogHeader>
                <form
                    id="adjust-form"
                    className="grid gap-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        form.transform((data) => ({
                            ...data,
                            delta_days: data.delta_days.replace(',', '.'),
                        }));
                        form.post(adjust.url({ leaveBalance: balance.id }), {
                            preserveScroll: true,
                            onSuccess: onClose,
                        });
                    }}
                >
                    <div className="grid gap-2">
                        <Label htmlFor="delta_days">Jumlah hari</Label>
                        <Input
                            id="delta_days"
                            inputMode="decimal"
                            placeholder="mis. 1 atau -0,5"
                            className="w-40"
                            value={form.data.delta_days}
                            onChange={(e) =>
                                form.setData('delta_days', e.target.value)
                            }
                        />
                        <p className="text-meta text-text-muted tnum">
                            Sisa sekarang {formatDays(balance.available)} hari
                            {preview !== null &&
                                ` → ${formatDays(preview)} hari`}
                        </p>
                        <InputError message={form.errors.delta_days} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="reason">Alasan</Label>
                        <Textarea
                            id="reason"
                            rows={2}
                            maxLength={255}
                            placeholder="mis. Kompensasi kerja di hari libur nasional"
                            value={form.data.reason}
                            onChange={(e) =>
                                form.setData('reason', e.target.value)
                            }
                        />
                        <InputError message={form.errors.reason} />
                    </div>
                </form>

                <section aria-label="Riwayat penyesuaian" className="space-y-2">
                    <h3 className="text-overline text-text-muted">
                        Riwayat penyesuaian
                    </h3>
                    {!loaded ? (
                        <div className="space-y-2" aria-busy="true">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-2/3" />
                        </div>
                    ) : loaded.items.length === 0 ? (
                        <p className="text-meta text-text-subtle">
                            Belum ada penyesuaian.
                        </p>
                    ) : (
                        <ul className="divide-y divide-divider rounded-lg border border-border text-meta">
                            {loaded.items.map((item) => (
                                <li
                                    key={item.id}
                                    className="flex items-start gap-3 px-4 py-3"
                                >
                                    <span
                                        className={cn(
                                            'w-12 shrink-0 font-semibold tnum',
                                            item.delta_days > 0
                                                ? 'text-success'
                                                : 'text-danger',
                                        )}
                                    >
                                        {signed(item.delta_days)}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-text">
                                            {item.reason}
                                        </span>
                                        <span className="block text-text-muted">
                                            {[
                                                item.actor,
                                                item.created_at
                                                    ? formatDateTime(
                                                          item.created_at,
                                                      )
                                                    : null,
                                            ]
                                                .filter(Boolean)
                                                .join(' · ')}
                                        </span>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onClose}>
                        Batal
                    </Button>
                    <Button
                        type="submit"
                        form="adjust-form"
                        disabled={form.processing}
                    >
                        Simpan penyesuaian
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
