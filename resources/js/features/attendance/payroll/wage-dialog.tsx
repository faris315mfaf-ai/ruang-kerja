import { router, useForm } from '@inertiajs/react';
import {
    AlertTriangle,
    Lock,
    RefreshCw,
    ShieldCheck,
    Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import InputError from '@/components/input-error';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DateInput } from '@/components/ui/date-input';
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
import { formatNumericDate } from '@/lib/format';
import { requestJson } from '@/lib/http';
import { formatRupiah } from '@/lib/requests';
import payrollRoutes from '@/routes/attendance/payroll';
import { formatRupiahInput, parseRupiahInput, wageRanges } from './payroll';
import type { PayrollRow, WageHistory } from './types';

type Props = {
    row: PayrollRow | null;
    /** Default "Berlaku mulai". */
    defaultFrom: string;
    today: string;
    reload: string[];
    onClose: () => void;
};

type Load =
    | { state: 'loading' }
    | { state: 'ready'; history: WageHistory }
    | { state: 'error' };

/**
 * "Atur upah harian" (mockup Upah.dc.html, without "Dasar perhitungan":
 * daily only): new wage from a date on, history with delete for rows in an
 * unlocked month.
 */
export function WageDialog({
    row,
    defaultFrom,
    today,
    reload,
    onClose,
}: Props) {
    const [load, setLoad] = useState<Load>({ state: 'loading' });
    const [attempt, setAttempt] = useState(0);
    const [deleting, setDeleting] = useState<string | null>(null);
    const form = useForm({
        daily_wage: formatRupiahInput(row?.daily_wage ?? null),
        effective_from: defaultFrom,
        note: '',
    });

    useEffect(() => {
        if (row === null) {
            return;
        }

        const controller = new AbortController();

        setLoad({ state: 'loading' });
        requestJson<WageHistory>(payrollRoutes.wages.index.url(row.user_id), {
            signal: controller.signal,
        })
            .then((history) => setLoad({ state: 'ready', history }))
            .catch(() => {
                if (!controller.signal.aborted) {
                    setLoad({ state: 'error' });
                }
            });

        return () => controller.abort();
    }, [row?.user_id, attempt]); // oxlint-disable-line react-hooks/exhaustive-deps

    const canManage = load.state === 'ready' && load.history.can.manage;
    const amount = parseRupiahInput(form.data.daily_wage);

    const submit = () => {
        if (!row) {
            return;
        }

        form.transform((data) => ({
            daily_wage: parseRupiahInput(data.daily_wage),
            effective_from: data.effective_from,
            note: data.note.trim() || null,
        }));
        form.put(payrollRoutes.wages.update.url(row.user_id), {
            preserveScroll: true,
            preserveState: true,
            only: reload,
            onSuccess: () => onClose(),
        });
    };

    const remove = (id: string) => {
        setDeleting(id);
        router.delete(payrollRoutes.wages.destroy.url(id), {
            preserveScroll: true,
            preserveState: true,
            only: reload,
            onSuccess: () => setAttempt((value) => value + 1),
            onFinish: () => setDeleting(null),
        });
    };

    const subtitle = row
        ? [
              row.division,
              row.employee_number ? `No. ${row.employee_number}` : null,
          ]
              .filter(Boolean)
              .join(' · ')
        : '';

    return (
        <Dialog open={row !== null} onOpenChange={(next) => !next && onClose()}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Atur upah harian</DialogTitle>
                    <DialogDescription>
                        {row?.name}
                        {subtitle ? ` · ${subtitle}` : ''}
                    </DialogDescription>
                </DialogHeader>

                <form
                    id="wage-form"
                    className="flex flex-col gap-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        submit();
                    }}
                >
                    <div className="grid gap-1.5">
                        <Label htmlFor="wage-amount">Upah harian</Label>
                        <div className="relative">
                            <span
                                aria-hidden
                                className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 font-semibold text-text-muted"
                            >
                                Rp
                            </span>
                            <Input
                                id="wage-amount"
                                inputMode="numeric"
                                autoComplete="off"
                                value={form.data.daily_wage}
                                disabled={!canManage}
                                onChange={(event) =>
                                    form.setData(
                                        'daily_wage',
                                        formatRupiahInput(
                                            parseRupiahInput(
                                                event.target.value,
                                            ),
                                        ),
                                    )
                                }
                                placeholder="150.000"
                                className="h-[52px] pl-12 font-mono text-[20px] font-semibold"
                                aria-invalid={Boolean(form.errors.daily_wage)}
                                required
                            />
                        </div>
                        <InputError message={form.errors.daily_wage} />
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="wage-from">Berlaku mulai</Label>
                        <DateInput
                            id="wage-from"
                            value={form.data.effective_from}
                            disabled={!canManage}
                            clearable={false}
                            onChange={(value) =>
                                form.setData('effective_from', value)
                            }
                        />
                        <InputError message={form.errors.effective_from} />
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="wage-note">Catatan</Label>
                        <Input
                            id="wage-note"
                            value={form.data.note}
                            disabled={!canManage}
                            maxLength={255}
                            onChange={(event) =>
                                form.setData('note', event.target.value)
                            }
                            placeholder="mis. Kenaikan setelah evaluasi Q3"
                        />
                        <InputError message={form.errors.note} />
                    </div>
                    {amount !== null && form.data.effective_from && (
                        <p className="rounded-lg bg-link-soft px-4 py-3 text-[15px] leading-[22px] text-text">
                            Upah {formatRupiah(amount)} berlaku untuk hari mulai{' '}
                            {formatNumericDate(form.data.effective_from)}.
                            Periode yang sudah dikunci tidak berubah.
                        </p>
                    )}
                </form>

                <section
                    aria-labelledby="wage-history"
                    className="flex flex-col gap-2"
                >
                    <h3
                        id="wage-history"
                        className="text-[15px] font-semibold text-text"
                    >
                        Riwayat upah
                    </h3>
                    {load.state === 'loading' && (
                        <div className="flex flex-col gap-2" aria-busy>
                            <Skeleton className="h-14 rounded-lg" />
                            <Skeleton className="h-14 rounded-lg" />
                        </div>
                    )}
                    {load.state === 'error' && (
                        <Alert variant="destructive">
                            <AlertTriangle aria-hidden />
                            <AlertDescription className="flex flex-col items-start gap-2">
                                Riwayat upah gagal dimuat.
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        setAttempt((value) => value + 1)
                                    }
                                >
                                    <RefreshCw aria-hidden />
                                    Coba lagi
                                </Button>
                            </AlertDescription>
                        </Alert>
                    )}
                    {load.state === 'ready' &&
                        (load.history.wages.length === 0 ? (
                            <p className="rounded-lg border border-dashed border-border-strong px-4 py-3 text-[15px] text-text-muted">
                                Belum ada upah. Hari kerja dihitung Rp0 sampai
                                upah diatur.
                            </p>
                        ) : (
                            <ol className="flex flex-col divide-y divide-divider rounded-lg border border-border">
                                {wageRanges(load.history.wages, today).map(
                                    (range) => {
                                        const wage = load.history.wages.find(
                                            (item) => item.id === range.id,
                                        )!;

                                        return (
                                            <li
                                                key={wage.id}
                                                className="flex items-center gap-3 px-4 py-2.5"
                                            >
                                                <span className="flex min-w-0 flex-1 flex-col">
                                                    <b className="font-mono text-[16px] font-semibold text-text">
                                                        {formatRupiah(
                                                            wage.daily_wage,
                                                        )}
                                                    </b>
                                                    <span className="truncate text-meta text-text-muted">
                                                        {range.range}
                                                        {wage.created_by_name &&
                                                            ` · oleh ${wage.created_by_name}`}
                                                        {wage.note &&
                                                            ` · ${wage.note}`}
                                                    </span>
                                                </span>
                                                {range.current && (
                                                    <Badge
                                                        variant="status"
                                                        tone="success"
                                                    >
                                                        Berlaku
                                                    </Badge>
                                                )}
                                                {range.upcoming && (
                                                    <Badge
                                                        variant="status"
                                                        tone="info"
                                                    >
                                                        Akan berlaku
                                                    </Badge>
                                                )}
                                                {wage.locked ? (
                                                    <Lock
                                                        className="size-4 text-text-subtle"
                                                        aria-label="Bulan terkunci"
                                                    />
                                                ) : (
                                                    canManage && (
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon-sm"
                                                            aria-label={`Hapus upah ${formatRupiah(wage.daily_wage)} mulai ${formatNumericDate(wage.effective_from)}`}
                                                            disabled={
                                                                deleting !==
                                                                null
                                                            }
                                                            onClick={() =>
                                                                remove(wage.id)
                                                            }
                                                            className="text-danger hover:bg-danger-soft hover:text-danger"
                                                        >
                                                            <Trash2
                                                                aria-hidden
                                                            />
                                                        </Button>
                                                    )
                                                )}
                                            </li>
                                        );
                                    },
                                )}
                            </ol>
                        ))}
                </section>

                <p className="flex items-start gap-2 text-meta text-text-muted">
                    <ShieldCheck
                        className="mt-0.5 size-4 shrink-0"
                        aria-hidden
                    />
                    Data gaji rahasia: hanya HR dan Super Admin; Direksi hanya
                    melihat. Setiap perubahan tercatat di audit log.
                </p>

                <DialogFooter>
                    <Button type="button" variant="quiet" onClick={onClose}>
                        Batal
                    </Button>
                    {canManage && (
                        <Button
                            type="submit"
                            form="wage-form"
                            disabled={form.processing || amount === null}
                        >
                            Simpan upah
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
