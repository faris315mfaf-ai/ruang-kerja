import { Head, router, useForm } from '@inertiajs/react';
import { Search, Upload, WalletCards } from 'lucide-react';
import { useState } from 'react';
import { DesktopOnlyNotice } from '@/components/desktop-only-notice';
import { EmptyState } from '@/components/empty-state';
import InputError from '@/components/input-error';
import { UserAvatar } from '@/components/shell/user-avatar';
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
import { BalanceAdjustDialog } from '@/features/admin-requests/balance-adjust-dialog';
import type { BalanceHistory } from '@/features/admin-requests/balance-adjust-dialog';
import { BalanceImportDialog } from '@/features/admin-requests/balance-import-dialog';
import { selectClass } from '@/features/requests/form-fields';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { formatDays } from '@/lib/requests';
import { cn } from '@/lib/utils';
import { generate, index, update } from '@/routes/admin/leave-balances';
import type { BalanceSummary, LeaveTypeInfo, Person } from '@/types/requests';

type Row = {
    user: Person;
    eligible: boolean;
    balance: BalanceSummary | null;
    /** Joined during the year: entitlement prorated. */
    prorated: boolean;
    joined_at: string | null;
};

type Props = {
    types: LeaveTypeInfo[];
    type: LeaveTypeInfo | null;
    year: number;
    years: number[];
    search: string;
    rows: Row[];
    history?: BalanceHistory;
    import: { columns: string[]; required: string[]; max_kilobytes: number };
    proration: {
        example_quota: number | null;
        example_july: number | null;
    };
};

type EditingRow = Row & { balance: BalanceSummary & { id: string } };

const signed = (value: number) =>
    value === 0
        ? '0'
        : `${value > 0 ? '+' : '−'}${formatDays(Math.abs(value))}`;

function EditBalance({
    row,
    onClose,
}: {
    row: EditingRow;
    onClose: () => void;
}) {
    const form = useForm({
        entitled_days: row.balance.entitled,
        carried_over_days: row.balance.carried_over,
        opening_days: row.balance.opening,
    });

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Saldo {row.user.name}</DialogTitle>
                    <DialogDescription>
                        Terpakai {formatDays(row.balance.used)} · menunggu{' '}
                        {formatDays(row.balance.pending)} hari. Jatah tidak
                        boleh kurang dari itu.
                    </DialogDescription>
                </DialogHeader>
                <form
                    id="balance-form"
                    className="grid grid-cols-2 gap-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        form.put(update.url({ leaveBalance: row.balance.id }), {
                            preserveScroll: true,
                            onSuccess: onClose,
                        });
                    }}
                >
                    <div className="grid gap-2">
                        <Label htmlFor="entitled_days">Jatah (hari)</Label>
                        <Input
                            id="entitled_days"
                            type="number"
                            min={0}
                            step={0.5}
                            value={form.data.entitled_days}
                            onChange={(e) =>
                                form.setData(
                                    'entitled_days',
                                    Number(e.target.value),
                                )
                            }
                        />
                        <InputError message={form.errors.entitled_days} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="carried_over_days">Bawaan (hari)</Label>
                        <Input
                            id="carried_over_days"
                            type="number"
                            min={0}
                            step={0.5}
                            value={form.data.carried_over_days}
                            onChange={(e) =>
                                form.setData(
                                    'carried_over_days',
                                    Number(e.target.value),
                                )
                            }
                        />
                        <InputError message={form.errors.carried_over_days} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="opening_days">Saldo awal (hari)</Label>
                        <Input
                            id="opening_days"
                            type="number"
                            min={0}
                            step={0.5}
                            value={form.data.opening_days}
                            onChange={(e) =>
                                form.setData(
                                    'opening_days',
                                    Number(e.target.value),
                                )
                            }
                        />
                        <InputError message={form.errors.opening_days} />
                    </div>
                    <p className="col-span-2 text-[13px] text-text-muted">
                        Saldo awal = sisa yang dibawa dari sistem lama.
                        Tambahan/potongan lain dicatat lewat Penyesuaian.
                    </p>
                </form>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onClose}>
                        Batal
                    </Button>
                    <Button
                        type="submit"
                        form="balance-form"
                        disabled={form.processing}
                    >
                        Simpan
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function LeaveBalances({
    types,
    type,
    year,
    years,
    search,
    rows,
    history,
    import: importReference,
    proration,
}: Props) {
    const breakpoint = useBreakpoint();
    const [editing, setEditing] = useState<EditingRow | null>(null);
    const [adjusting, setAdjusting] = useState<EditingRow | null>(null);
    const [importing, setImporting] = useState(false);
    const [query, setQuery] = useState(search);
    const missing = rows.filter(
        (row) => row.eligible && row.balance === null,
    ).length;

    if (breakpoint === 'mobile') {
        return (
            <>
                <Head title="Saldo cuti" />
                <DesktopOnlyNotice feature="Kelola saldo cuti" />
            </>
        );
    }

    const visit = (params: Record<string, string | number | undefined>) =>
        router.get(
            index.url({
                query: {
                    jenis: type?.id,
                    tahun: year,
                    cari: search || undefined,
                    ...params,
                },
            }),
            {},
            { preserveState: true, preserveScroll: true, replace: true },
        );

    return (
        <>
            <Head title="Saldo cuti" />
            <div className="mx-auto max-w-[1200px] space-y-6">
                <header className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-xl leading-7 font-semibold text-text">
                            Saldo cuti
                        </h1>
                        <p className="text-sm text-text-muted">
                            Jatah, bawaan, saldo awal, penyesuaian, dan
                            pemakaian cuti per karyawan. Saldo tahun baru dibuat
                            otomatis tiap 1 Januari.
                        </p>
                        {proration.example_quota !== null &&
                            proration.example_july !== null && (
                                <p className="mt-1 text-[13px] text-text-subtle">
                                    Karyawan baru: jatah prorata sisa bulan
                                    (bulan masuk dihitung bila tanggal 1–15),
                                    dibulatkan ke bawah per 0,5 hari — mis.
                                    masuk 1 Juli ={' '}
                                    {formatDays(proration.example_july)} dari{' '}
                                    {formatDays(proration.example_quota)} hari.
                                </p>
                            )}
                    </div>
                    {type && (
                        <div className="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setImporting(true)}
                            >
                                <Upload aria-hidden /> Impor saldo
                            </Button>
                            <Button
                                type="button"
                                onClick={() =>
                                    router.post(
                                        generate.url(),
                                        { year },
                                        { preserveScroll: true },
                                    )
                                }
                            >
                                Buat saldo {year}
                                {missing > 0 ? ` (${missing} belum ada)` : ''}
                            </Button>
                        </div>
                    )}
                </header>

                <div className="flex flex-wrap items-center gap-3">
                    <select
                        aria-label="Jenis cuti"
                        className={cn(selectClass, 'w-56')}
                        value={type?.id ?? ''}
                        onChange={(e) => visit({ jenis: e.target.value })}
                    >
                        {types.map((t) => (
                            <option key={t.id} value={t.id}>
                                {t.name}
                            </option>
                        ))}
                    </select>
                    <select
                        aria-label="Tahun"
                        className={cn(selectClass, 'w-28')}
                        value={year}
                        onChange={(e) =>
                            visit({ tahun: Number(e.target.value) })
                        }
                    >
                        {years.map((y) => (
                            <option key={y} value={y}>
                                {y}
                            </option>
                        ))}
                    </select>
                    <form
                        className="relative"
                        onSubmit={(event) => {
                            event.preventDefault();
                            visit({ cari: query || undefined });
                        }}
                    >
                        <Search
                            className="pointer-events-none absolute top-2.5 left-3 size-4 text-text-muted"
                            aria-hidden
                        />
                        <Input
                            aria-label="Cari karyawan"
                            className="w-64 pl-9"
                            placeholder="Cari karyawan…"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                    </form>
                </div>

                {!type ? (
                    <EmptyState
                        icon={WalletCards}
                        title="Belum ada jenis cuti bersaldo"
                        description="Atur jatah per tahun pada jenis cuti di menu Jenis pengajuan."
                    />
                ) : rows.length === 0 ? (
                    <EmptyState
                        icon={WalletCards}
                        title="Tidak ada karyawan"
                        description="Ubah pencarian."
                    />
                ) : (
                    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
                        <table className="w-full text-sm">
                            <thead className="bg-surface-2/60 text-left text-[13px] text-text-muted">
                                <tr>
                                    <th
                                        scope="col"
                                        className="px-4 py-2.5 font-normal"
                                    >
                                        Karyawan
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-3 py-2.5 text-right font-normal"
                                    >
                                        Jatah
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-3 py-2.5 text-right font-normal"
                                    >
                                        Bawaan
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-3 py-2.5 text-right font-normal"
                                    >
                                        Saldo awal
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-3 py-2.5 text-right font-normal"
                                    >
                                        Penyesuaian
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-3 py-2.5 text-right font-normal"
                                    >
                                        Terpakai
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-3 py-2.5 text-right font-normal"
                                    >
                                        Menunggu
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-3 py-2.5 text-right font-normal"
                                    >
                                        Sisa
                                    </th>
                                    <th scope="col" className="px-4 py-2.5" />
                                </tr>
                            </thead>
                            <tbody className="tnum">
                                {rows.map((row) => (
                                    <tr
                                        key={row.user.id}
                                        className="border-t border-border"
                                    >
                                        <td className="px-4 py-2.5">
                                            <span className="flex items-center gap-2">
                                                <UserAvatar
                                                    name={row.user.name}
                                                    src={row.user.avatar}
                                                    className="size-7"
                                                />
                                                <span>
                                                    <span className="block font-medium text-text">
                                                        {row.user.name}
                                                    </span>
                                                    <span className="block text-xs text-text-muted">
                                                        {[
                                                            row.user.position,
                                                            row.user.division,
                                                        ]
                                                            .filter(Boolean)
                                                            .join(' · ')}
                                                    </span>
                                                </span>
                                            </span>
                                        </td>
                                        {row.balance ? (
                                            <>
                                                <td className="px-3 py-2.5 text-right">
                                                    {formatDays(
                                                        row.balance.entitled,
                                                    )}
                                                    {row.prorated && (
                                                        <span
                                                            className="ml-1.5 rounded-full bg-info/10 px-1.5 py-0.5 text-[11px] text-info"
                                                            title={`Prorata: bergabung ${row.joined_at ?? ''}`}
                                                        >
                                                            prorata
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2.5 text-right">
                                                    {formatDays(
                                                        row.balance
                                                            .carried_over,
                                                    )}
                                                </td>
                                                <td className="px-3 py-2.5 text-right">
                                                    {formatDays(
                                                        row.balance.opening,
                                                    )}
                                                </td>
                                                <td className="px-3 py-2.5 text-right">
                                                    {signed(
                                                        row.balance.adjustments,
                                                    )}
                                                </td>
                                                <td className="px-3 py-2.5 text-right">
                                                    {formatDays(
                                                        row.balance.used,
                                                    )}
                                                </td>
                                                <td className="px-3 py-2.5 text-right">
                                                    {formatDays(
                                                        row.balance.pending,
                                                    )}
                                                </td>
                                                <td className="px-3 py-2.5 text-right font-semibold">
                                                    {formatDays(
                                                        row.balance.available,
                                                    )}
                                                </td>
                                                <td className="px-4 py-2.5 text-right whitespace-nowrap">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() =>
                                                            row.balance?.id &&
                                                            setEditing({
                                                                ...row,
                                                                balance: {
                                                                    ...row.balance,
                                                                    id: row
                                                                        .balance
                                                                        .id,
                                                                },
                                                            })
                                                        }
                                                    >
                                                        Ubah
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() =>
                                                            row.balance?.id &&
                                                            setAdjusting({
                                                                ...row,
                                                                balance: {
                                                                    ...row.balance,
                                                                    id: row
                                                                        .balance
                                                                        .id,
                                                                },
                                                            })
                                                        }
                                                    >
                                                        Sesuaikan
                                                    </Button>
                                                </td>
                                            </>
                                        ) : (
                                            <td
                                                colSpan={8}
                                                className="px-3 py-2.5 text-right text-text-muted"
                                            >
                                                {row.eligible
                                                    ? 'Belum ada saldo'
                                                    : 'Belum berhak'}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            {editing && (
                <EditBalance row={editing} onClose={() => setEditing(null)} />
            )}
            {adjusting && (
                <BalanceAdjustDialog
                    user={adjusting.user}
                    balance={adjusting.balance}
                    history={history}
                    onClose={() => setAdjusting(null)}
                />
            )}
            <BalanceImportDialog
                open={importing}
                onOpenChange={setImporting}
                reference={importReference}
            />
        </>
    );
}

LeaveBalances.layout = {
    breadcrumbs: [
        { title: 'Admin', href: index() },
        { title: 'Saldo cuti', href: index() },
    ],
    title: 'Saldo cuti',
    back: '/menu',
};
