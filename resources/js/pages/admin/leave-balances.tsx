import { Head, router, useForm } from '@inertiajs/react';
import { Search, Upload, WalletCards } from 'lucide-react';
import { useState } from 'react';
import { DesktopOnlyNotice } from '@/components/desktop-only-notice';
import { EmptyState } from '@/components/empty-state';
import InputError from '@/components/input-error';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Badge } from '@/components/ui/badge';
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
import { Panel } from '@/components/ui/panel';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { NativeSelect } from '@/features/admin/native-select';
import { AdminPageHeader, AdminToolbar } from '@/features/admin/page-header';
import { BalanceAdjustDialog } from '@/features/admin-requests/balance-adjust-dialog';
import type { BalanceHistory } from '@/features/admin-requests/balance-adjust-dialog';
import { BalanceImportDialog } from '@/features/admin-requests/balance-import-dialog';
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
                    <p className="col-span-2 text-meta text-text-muted">
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
            <div className="flex flex-col gap-6">
                <AdminPageHeader
                    overline="Admin · Pengajuan"
                    title="Saldo cuti"
                    description="Jatah, bawaan, saldo awal, penyesuaian, dan pemakaian cuti per karyawan. Saldo tahun baru dibuat otomatis tiap 1 Januari."
                    actions={
                        type && (
                            <>
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
                                    {missing > 0
                                        ? ` (${missing} belum ada)`
                                        : ''}
                                </Button>
                            </>
                        )
                    }
                />

                <AdminToolbar>
                    <NativeSelect
                        aria-label="Jenis cuti"
                        className="w-60"
                        value={type?.id ?? ''}
                        onChange={(e) => visit({ jenis: e.target.value })}
                    >
                        {types.map((t) => (
                            <option key={t.id} value={t.id}>
                                {t.name}
                            </option>
                        ))}
                    </NativeSelect>
                    <NativeSelect
                        aria-label="Tahun"
                        className="w-32"
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
                    </NativeSelect>
                    <form
                        role="search"
                        className="relative"
                        onSubmit={(event) => {
                            event.preventDefault();
                            visit({ cari: query || undefined });
                        }}
                    >
                        <Search
                            className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-text-muted"
                            aria-hidden
                        />
                        <Input
                            aria-label="Cari karyawan"
                            className="w-72 pl-11"
                            placeholder="Cari karyawan…"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                    </form>
                </AdminToolbar>

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
                    <Panel
                        flush
                        title={`${type.name} ${year}`}
                        action={
                            <span className="text-meta text-text-muted tnum">
                                {rows.length} karyawan
                            </span>
                        }
                        bodyClassName="border-t border-divider"
                    >
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead
                                        scope="col"
                                        className="pl-6 md:pl-7"
                                    >
                                        Karyawan
                                    </TableHead>
                                    {[
                                        'Jatah',
                                        'Bawaan',
                                        'Saldo awal',
                                        'Penyesuaian',
                                        'Terpakai',
                                        'Menunggu',
                                        'Sisa',
                                    ].map((label) => (
                                        <TableHead
                                            key={label}
                                            scope="col"
                                            className="text-right"
                                        >
                                            {label}
                                        </TableHead>
                                    ))}
                                    <TableHead
                                        scope="col"
                                        className="pr-6 md:pr-7"
                                    >
                                        <span className="sr-only">Aksi</span>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.map((row) => (
                                    <TableRow key={row.user.id}>
                                        <TableCell className="pl-6 md:pl-7">
                                            <span className="flex items-center gap-3">
                                                <UserAvatar
                                                    name={row.user.name}
                                                    src={row.user.avatar}
                                                    className="size-10"
                                                />
                                                <span className="flex flex-col">
                                                    <span className="text-[16px] font-semibold">
                                                        {row.user.name}
                                                    </span>
                                                    <span className="text-meta text-text-muted">
                                                        {[
                                                            row.user.position,
                                                            row.user.division,
                                                        ]
                                                            .filter(Boolean)
                                                            .join(' · ')}
                                                    </span>
                                                </span>
                                            </span>
                                        </TableCell>
                                        {row.balance ? (
                                            <>
                                                <TableCell className="text-right">
                                                    <span className="inline-flex items-center gap-2">
                                                        {row.prorated && (
                                                            <Badge
                                                                variant="status"
                                                                tone="info"
                                                                className="h-6 px-2 text-meta"
                                                                title={`Prorata: bergabung ${row.joined_at ?? ''}`}
                                                            >
                                                                prorata
                                                            </Badge>
                                                        )}
                                                        {formatDays(
                                                            row.balance
                                                                .entitled,
                                                        )}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {formatDays(
                                                        row.balance
                                                            .carried_over,
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {formatDays(
                                                        row.balance.opening,
                                                    )}
                                                </TableCell>
                                                <TableCell
                                                    className={cn(
                                                        'text-right',
                                                        row.balance
                                                            .adjustments > 0 &&
                                                            'text-success',
                                                        row.balance
                                                            .adjustments < 0 &&
                                                            'text-danger',
                                                    )}
                                                >
                                                    {signed(
                                                        row.balance.adjustments,
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {formatDays(
                                                        row.balance.used,
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right text-text-muted">
                                                    {formatDays(
                                                        row.balance.pending,
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right text-[17px] font-bold">
                                                    {formatDays(
                                                        row.balance.available,
                                                    )}
                                                </TableCell>
                                                <TableCell className="pr-6 text-right md:pr-7">
                                                    <span className="inline-flex gap-1">
                                                        <Button
                                                            type="button"
                                                            variant="quiet"
                                                            size="sm"
                                                            onClick={() =>
                                                                row.balance
                                                                    ?.id &&
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
                                                            variant="quiet"
                                                            size="sm"
                                                            onClick={() =>
                                                                row.balance
                                                                    ?.id &&
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
                                                    </span>
                                                </TableCell>
                                            </>
                                        ) : (
                                            <TableCell
                                                colSpan={8}
                                                className="pr-6 text-right md:pr-7"
                                            >
                                                <Badge
                                                    variant="status"
                                                    tone={
                                                        row.eligible
                                                            ? 'warning'
                                                            : 'neutral'
                                                    }
                                                >
                                                    {row.eligible
                                                        ? 'Belum ada saldo'
                                                        : 'Belum berhak'}
                                                </Badge>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        {proration.example_quota !== null &&
                            proration.example_july !== null && (
                                <p className="border-t border-divider px-6 pt-4 text-meta text-text-muted md:px-7">
                                    Karyawan baru: jatah prorata sisa bulan
                                    (bulan masuk dihitung bila tanggal 1–15),
                                    dibulatkan ke bawah per 0,5 hari — mis.
                                    masuk 1 Juli ={' '}
                                    {formatDays(proration.example_july)} dari{' '}
                                    {formatDays(proration.example_quota)} hari.
                                </p>
                            )}
                    </Panel>
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
    width: 'wide',
    breadcrumbs: [
        { title: 'Admin', href: '' },
        { title: 'Saldo cuti', href: index() },
    ],
    title: 'Saldo cuti',
    back: '/menu',
};
