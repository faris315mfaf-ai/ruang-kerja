import { AlertTriangle, Pencil } from 'lucide-react';
import { formatNumber } from '@/lib/format';
import { formatRupiah } from '@/lib/requests';
import { cn, focusRing } from '@/lib/utils';
import type { PayrollReport, PayrollRow } from './types';

type Props = {
    report: PayrollReport;
    /** Edit buttons for the wage (HR / Super Admin). */
    canManage: boolean;
    onEditWage: (row: PayrollRow) => void;
};

const HEAD =
    'h-12 px-2.5 text-right text-[14px] font-bold whitespace-nowrap text-text-muted';
const NUM = 'px-2.5 py-2 text-right text-[15px] whitespace-nowrap';

/** Gaji harian per employee (mockup Gaji.dc.html "Tabel gaji"). */
export function PayrollTable({ report, canManage, onEditWage }: Props) {
    return (
        <section
            aria-label="Tabel gaji"
            className="min-w-0 overflow-hidden rounded-panel border border-border bg-surface shadow-card"
        >
            <div className="overflow-x-auto">
                <table className="w-full min-w-[780px] border-collapse tnum">
                    <thead className="border-b border-border bg-background">
                        <tr>
                            <th
                                scope="col"
                                className={cn(HEAD, 'pl-6 text-left')}
                            >
                                Pegawai
                            </th>
                            <th scope="col" className={HEAD}>
                                Upah harian
                            </th>
                            <th scope="col" className={HEAD}>
                                Hadir
                            </th>
                            <th
                                scope="col"
                                className={HEAD}
                                title="Cuti, sakit, dan izin yang dibayar menurut aturan"
                            >
                                <abbr
                                    className="no-underline"
                                    title="Cuti, sakit, dan izin yang dibayar"
                                >
                                    C/S/I dibayar
                                </abbr>
                            </th>
                            <th scope="col" className={HEAD}>
                                Alpha
                            </th>
                            <th scope="col" className={HEAD}>
                                Hari dibayar
                            </th>
                            <th scope="col" className={HEAD}>
                                Potongan
                            </th>
                            <th scope="col" className={cn(HEAD, 'pr-6')}>
                                Total
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-divider">
                        {report.rows.map((row) => (
                            <tr
                                key={row.user_id}
                                className="transition-colors duration-120 ease-brand hover:bg-surface-2/60"
                            >
                                <th
                                    scope="row"
                                    className="py-2.5 pr-3 pl-6 text-left font-normal"
                                >
                                    <span className="block text-[15px] leading-5 font-semibold whitespace-nowrap text-text">
                                        {row.name}
                                    </span>
                                    <span className="block text-[13px] leading-[18px] text-text-muted">
                                        {row.division ?? '–'}
                                    </span>
                                </th>
                                <td className={NUM}>
                                    <WageCell
                                        row={row}
                                        canManage={canManage}
                                        onEdit={() => onEditWage(row)}
                                    />
                                </td>
                                <td className={cn(NUM, 'text-text')}>
                                    {formatNumber(row.present_days)}
                                </td>
                                <td className={cn(NUM, 'text-text')}>
                                    {formatNumber(row.paid_leave_days)}
                                    {row.unpaid_days > 0 && (
                                        <span
                                            className="block text-[12px] text-text-muted"
                                            title="Cuti, sakit, atau izin yang tidak dibayar"
                                        >
                                            +{formatNumber(row.unpaid_days)}{' '}
                                            tidak dibayar
                                        </span>
                                    )}
                                </td>
                                <td
                                    className={cn(
                                        NUM,
                                        row.absent_days > 0
                                            ? 'font-semibold text-danger'
                                            : 'text-text-muted',
                                    )}
                                >
                                    {formatNumber(row.absent_days)}
                                </td>
                                <td
                                    className={cn(
                                        NUM,
                                        'font-semibold text-text',
                                    )}
                                >
                                    {formatNumber(row.paid_days)} hari
                                    {row.pending_days > 0 && (
                                        <span className="block text-[12px] font-normal text-warning">
                                            {formatNumber(row.pending_days)}{' '}
                                            belum dihitung
                                        </span>
                                    )}
                                </td>
                                <td
                                    className={cn(
                                        NUM,
                                        row.deduction > 0
                                            ? 'text-danger'
                                            : 'text-text-muted',
                                    )}
                                >
                                    {row.deduction > 0
                                        ? `− ${formatRupiah(row.deduction)}`
                                        : '—'}
                                </td>
                                <td
                                    className={cn(
                                        NUM,
                                        'pr-6 font-semibold text-text',
                                    )}
                                >
                                    {formatRupiah(row.total)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="border-t border-border bg-background">
                        <tr>
                            <th
                                scope="row"
                                className="py-3 pr-3 pl-6 text-left text-[15px] font-bold text-text"
                            >
                                Total {formatNumber(report.totals.employees)}{' '}
                                pegawai
                            </th>
                            <td colSpan={4} />
                            <td className={cn(NUM, 'font-semibold text-text')}>
                                {formatNumber(report.totals.paid_days)} hari
                            </td>
                            <td />
                            <td
                                className={cn(
                                    NUM,
                                    'pr-6 text-[16px] font-bold text-text',
                                )}
                            >
                                {formatRupiah(report.totals.total)}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </section>
    );
}

function WageCell({
    row,
    canManage,
    onEdit,
}: {
    row: PayrollRow;
    canManage: boolean;
    onEdit: () => void;
}) {
    if (row.missing_wage && row.daily_wage === null) {
        return canManage ? (
            <button
                type="button"
                onClick={onEdit}
                className={cn(
                    'inline-flex min-h-9 items-center gap-1.5 rounded-sm bg-warning-soft px-2.5 text-[14px] font-semibold text-warning hover:brightness-95',
                    focusRing,
                )}
            >
                <AlertTriangle className="size-4" aria-hidden />
                Upah belum diatur
            </button>
        ) : (
            <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-warning">
                <AlertTriangle className="size-4" aria-hidden />
                Upah belum diatur
            </span>
        );
    }

    return (
        <span className="inline-flex items-center justify-end gap-1">
            <span className="flex flex-col items-end">
                <span className="text-text">
                    {formatRupiah(row.daily_wage)}
                </span>
                {row.wage_changed_in_period && (
                    <span className="text-[12px] text-text-muted">
                        berubah bulan ini
                    </span>
                )}
                {row.missing_wage && row.daily_wage !== null && (
                    <span className="text-[12px] text-warning">
                        sebagian hari tanpa upah
                    </span>
                )}
            </span>
            {canManage && (
                <button
                    type="button"
                    onClick={onEdit}
                    aria-label={`Ubah upah ${row.name}`}
                    className={cn(
                        'flex size-9 items-center justify-center rounded-md text-link hover:bg-link-soft',
                        focusRing,
                    )}
                >
                    <Pencil className="size-4" aria-hidden />
                </button>
            )}
        </span>
    );
}
