import { router, useForm } from '@inertiajs/react';
import { UserRoundCog, X } from 'lucide-react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { selectClass } from '@/features/requests/form-fields';
import { formatDateRange } from '@/lib/requests';
import { cn } from '@/lib/utils';
import {
    destroy as destroyDelegation,
    store as storeDelegation,
} from '@/routes/approvals/delegations';
import type { Delegation } from '@/types/requests';

export type DelegationProps = {
    items: Delegation[];
    colleagues: { id: string; name: string; avatar: string | null }[];
    today: string;
};

/** "Delegasi saat penyetuju cuti": list + add + end. */
export function DelegationDialog({
    delegations,
    mobile = false,
}: {
    delegations: DelegationProps;
    mobile?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const form = useForm({
        delegate_id: '',
        starts_on: delegations.today,
        ends_on: delegations.today,
        reason: '',
    });
    const active = delegations.items.find((item) => item.active);

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        form.post(storeDelegation.url(), {
            preserveScroll: true,
            onSuccess: () => form.reset(),
        });
    };

    return (
        <>
            <Button
                type="button"
                variant="outline"
                size={mobile ? 'lg' : 'default'}
                className={cn(mobile && 'w-full')}
                onClick={() => setOpen(true)}
            >
                <UserRoundCog aria-hidden />
                {active
                    ? `Didelegasikan ke ${active.delegate.name.split(' ')[0]}`
                    : 'Delegasi'}
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Delegasi persetujuan</DialogTitle>
                        <DialogDescription>
                            Selama periode ini, pengajuan yang menunggu Anda
                            diteruskan ke rekan yang ditunjuk.
                        </DialogDescription>
                    </DialogHeader>

                    {delegations.items.length > 0 && (
                        <ul className="space-y-2">
                            {delegations.items.map((item) => (
                                <li
                                    key={item.id}
                                    className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 text-[15px]"
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="font-semibold text-text">
                                            {item.delegate.name}
                                        </p>
                                        <p className="text-meta text-text-muted">
                                            {formatDateRange(
                                                item.starts_on,
                                                item.ends_on,
                                            )}
                                            {item.active ? ' · aktif' : ''}
                                            {item.reason
                                                ? ` · ${item.reason}`
                                                : ''}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        aria-label={`Hentikan delegasi ke ${item.delegate.name}`}
                                        className="flex size-11 items-center justify-center rounded-control text-text-muted hover:bg-surface-2 focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
                                        onClick={() =>
                                            router.delete(
                                                destroyDelegation.url({
                                                    delegation: item.id,
                                                }),
                                                { preserveScroll: true },
                                            )
                                        }
                                    >
                                        <X className="size-4" aria-hidden />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}

                    <form onSubmit={submit} className="grid gap-3">
                        <div className="grid gap-2">
                            <Label htmlFor="delegate_id">Delegasikan ke</Label>
                            <select
                                id="delegate_id"
                                className={selectClass}
                                value={form.data.delegate_id}
                                onChange={(e) =>
                                    form.setData('delegate_id', e.target.value)
                                }
                            >
                                <option value="">Pilih rekan…</option>
                                {delegations.colleagues.map((person) => (
                                    <option key={person.id} value={person.id}>
                                        {person.name}
                                    </option>
                                ))}
                            </select>
                            <InputError message={form.errors.delegate_id} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-2">
                                <Label htmlFor="starts_on">Mulai</Label>
                                <Input
                                    id="starts_on"
                                    type="date"
                                    min={delegations.today}
                                    value={form.data.starts_on}
                                    onChange={(e) =>
                                        form.setData(
                                            'starts_on',
                                            e.target.value,
                                        )
                                    }
                                />
                                <InputError message={form.errors.starts_on} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="ends_on">Selesai</Label>
                                <Input
                                    id="ends_on"
                                    type="date"
                                    min={form.data.starts_on}
                                    value={form.data.ends_on}
                                    onChange={(e) =>
                                        form.setData('ends_on', e.target.value)
                                    }
                                />
                                <InputError message={form.errors.ends_on} />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="delegation_reason">
                                Keterangan (opsional)
                            </Label>
                            <Input
                                id="delegation_reason"
                                maxLength={255}
                                placeholder="Mis. cuti tahunan"
                                value={form.data.reason}
                                onChange={(e) =>
                                    form.setData('reason', e.target.value)
                                }
                            />
                        </div>
                        <Button type="submit" disabled={form.processing}>
                            Simpan delegasi
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
