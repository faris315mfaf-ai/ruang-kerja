import { router } from '@inertiajs/react';
import { CircleAlert, CircleCheck, Download, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
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
import { formatDays } from '@/lib/requests';
import { cn } from '@/lib/utils';
import { importMethod } from '@/routes/admin/leave-balances';
import { template } from '@/routes/admin/leave-balances/import';

export type BalanceImportRow = {
    row: number;
    email: string | null;
    name: string | null;
    type_code: string | null;
    year: number | null;
    opening: number | null;
    entitled: number | null;
    carried_over: number | null;
    adjustment: number | null;
    reason: string | null;
    available_before: number | null;
    available_after: number | null;
    errors: string[];
    applied: boolean;
};

export type BalanceImportReport = {
    mode: 'preview' | 'commit';
    file: string;
    truncated: boolean;
    missing_columns: string[];
    rows: BalanceImportRow[];
    summary: { total: number; ok: number; error: number; applied: number };
};

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    reference: { columns: string[]; required: string[]; max_kilobytes: number };
};

const signed = (value: number) =>
    `${value > 0 ? '+' : '−'}${formatDays(Math.abs(value))}`;

/** What a row changes, e.g. "saldo awal 4 · penyesuaian +1 (Kompensasi)". */
function changes(row: BalanceImportRow): string {
    return [
        row.opening !== null ? `saldo awal ${formatDays(row.opening)}` : null,
        row.entitled !== null ? `jatah ${formatDays(row.entitled)}` : null,
        row.carried_over !== null
            ? `bawaan ${formatDays(row.carried_over)}`
            : null,
        row.adjustment !== null
            ? `penyesuaian ${signed(row.adjustment)}${row.reason ? ` (${row.reason})` : ''}`
            : null,
    ]
        .filter(Boolean)
        .join(' · ');
}

/**
 * Admin › Saldo cuti › Impor: template → upload → preview with per-row errors
 * → apply the valid rows. The same file is sent twice (preview, then commit);
 * nothing is stored between the two steps.
 */
export function BalanceImportDialog({ open, onOpenChange, reference }: Props) {
    const input = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [report, setReport] = useState<BalanceImportReport | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);

    const send = (mode: 'preview' | 'commit', chosen: File) => {
        setProcessing(true);
        setError(null);
        router.post(
            importMethod.url(),
            { file: chosen, mode },
            {
                forceFormData: true,
                preserveScroll: true,
                onFlash: (flash) => {
                    const data = (
                        flash as { balanceImport?: BalanceImportReport }
                    ).balanceImport;
                    setReport(data ?? null);
                },
                onError: (errors) =>
                    setError(errors.file ?? errors.mode ?? null),
                onFinish: () => setProcessing(false),
            },
        );
    };

    const choose = (chosen: File | undefined) => {
        if (!chosen) {
            return;
        }

        setFile(chosen);
        setReport(null);
        send('preview', chosen);
    };

    const close = (next: boolean) => {
        if (!next) {
            setFile(null);
            setReport(null);
            setError(null);
        }

        onOpenChange(next);
    };

    const committed = report?.mode === 'commit';

    return (
        <Dialog open={open} onOpenChange={close}>
            <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Impor saldo cuti</DialogTitle>
                    <DialogDescription>
                        Isi saldo awal, jatah, bawaan, atau penyesuaian (dengan
                        alasan) per karyawan dari CSV/XLSX. Pratinjau dulu;
                        hanya baris yang valid yang diterapkan.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 text-sm">
                    <div className="rounded-lg border border-border bg-surface-2/60 p-3 text-[13px] text-text-muted">
                        <p>
                            Kolom:{' '}
                            {reference.columns.map((column, index) => (
                                <span key={column}>
                                    {index > 0 && ', '}
                                    <code className="font-mono text-text">
                                        {column}
                                    </code>
                                    {reference.required.includes(column) && '*'}
                                </span>
                            ))}
                            . <code className="font-mono">jenis</code> = kode
                            (mis. CUT). Kosongkan kolom yang tidak diubah;{' '}
                            <code className="font-mono">penyesuaian</code> boleh
                            minus dan wajib disertai alasan.
                        </p>
                        <p className="mt-2 flex flex-wrap gap-2">
                            {(['xlsx', 'csv'] as const).map((format) => (
                                <Button
                                    key={format}
                                    asChild
                                    variant="outline"
                                    size="sm"
                                >
                                    <a href={template.url({ format })}>
                                        <Download aria-hidden /> Templat{' '}
                                        {format.toUpperCase()}
                                    </a>
                                </Button>
                            ))}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <input
                            ref={input}
                            type="file"
                            accept=".csv,.xlsx"
                            className="sr-only"
                            aria-label="Berkas impor saldo"
                            onChange={(event) => {
                                choose(event.target.files?.[0]);
                                event.target.value = '';
                            }}
                        />
                        <Button
                            type="button"
                            variant="outline"
                            disabled={processing}
                            onClick={() => input.current?.click()}
                        >
                            <Upload aria-hidden />
                            {file ? 'Ganti berkas' : 'Pilih berkas'}
                        </Button>
                        {file && (
                            <span className="truncate text-text-muted">
                                {file.name}
                            </span>
                        )}
                        <span className="text-[13px] text-text-subtle">
                            Maks. {Math.round(reference.max_kilobytes / 1024)}{' '}
                            MB
                        </span>
                    </div>
                    <InputError message={error ?? undefined} />

                    {report && report.missing_columns.length > 0 && (
                        <p
                            role="alert"
                            className="flex items-center gap-2 rounded-lg bg-danger/10 px-3 py-2 text-danger"
                        >
                            <CircleAlert className="size-4" aria-hidden />
                            Kolom wajib tidak ada:{' '}
                            {report.missing_columns.join(', ')}. Pakai templat.
                        </p>
                    )}

                    {report && report.rows.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-text" aria-live="polite">
                                {committed
                                    ? `${report.summary.applied} baris diterapkan`
                                    : `${report.summary.ok} baris siap diterapkan`}
                                {report.summary.error > 0 &&
                                    ` · ${report.summary.error} baris bermasalah${committed ? ' (dilewati)' : ''}`}
                                {report.truncated &&
                                    ' · berkas terpotong (terlalu banyak baris)'}
                            </p>
                            <div className="max-h-80 overflow-auto rounded-lg border border-border">
                                <table className="w-full text-[13px]">
                                    <thead className="sticky top-0 bg-surface-2 text-left text-text-muted">
                                        <tr>
                                            <th
                                                scope="col"
                                                className="px-3 py-2 font-normal"
                                            >
                                                Baris
                                            </th>
                                            <th
                                                scope="col"
                                                className="px-3 py-2 font-normal"
                                            >
                                                Karyawan
                                            </th>
                                            <th
                                                scope="col"
                                                className="px-3 py-2 font-normal"
                                            >
                                                Perubahan
                                            </th>
                                            <th
                                                scope="col"
                                                className="px-3 py-2 text-right font-normal"
                                            >
                                                Sisa
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="tnum">
                                        {report.rows.map((row) => {
                                            const failed =
                                                row.errors.length > 0;

                                            return (
                                                <tr
                                                    key={row.row}
                                                    className={cn(
                                                        'border-t border-border align-top',
                                                        failed && 'bg-danger/5',
                                                    )}
                                                >
                                                    <td className="px-3 py-2 text-text-muted">
                                                        {row.row}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <span className="block text-text">
                                                            {row.name ??
                                                                row.email ??
                                                                '—'}
                                                        </span>
                                                        <span className="block text-text-muted">
                                                            {[
                                                                row.type_code,
                                                                row.year,
                                                            ]
                                                                .filter(Boolean)
                                                                .join(' · ')}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        {failed ? (
                                                            <ul className="space-y-0.5 text-danger">
                                                                {row.errors.map(
                                                                    (
                                                                        message,
                                                                    ) => (
                                                                        <li
                                                                            key={
                                                                                message
                                                                            }
                                                                        >
                                                                            {
                                                                                message
                                                                            }
                                                                        </li>
                                                                    ),
                                                                )}
                                                            </ul>
                                                        ) : (
                                                            <span className="flex items-start gap-1.5 text-text">
                                                                {row.applied && (
                                                                    <CircleCheck
                                                                        className="mt-0.5 size-3.5 shrink-0 text-success"
                                                                        aria-label="Diterapkan"
                                                                    />
                                                                )}
                                                                {changes(row)}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2 text-right whitespace-nowrap">
                                                        {row.available_before !==
                                                            null &&
                                                        row.available_after !==
                                                            null
                                                            ? `${formatDays(row.available_before)} → ${formatDays(row.available_after)}`
                                                            : '—'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => close(false)}
                    >
                        {committed ? 'Tutup' : 'Batal'}
                    </Button>
                    {!committed && (
                        <Button
                            type="button"
                            disabled={
                                processing ||
                                !file ||
                                !report ||
                                report.summary.ok === 0
                            }
                            onClick={() => file && send('commit', file)}
                        >
                            Terapkan {report?.summary.ok ?? 0} baris
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
