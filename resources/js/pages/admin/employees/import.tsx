import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowLeft,
    CheckCircle2,
    Download,
    FileSpreadsheet,
    Upload,
} from 'lucide-react';
import { useState } from 'react';
import { DesktopOnlyNotice } from '@/components/desktop-only-notice';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import type {
    EmployeeImportProps,
    ImportReport,
    ImportRowResult,
} from '@/features/employees/types';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { importMethod, index } from '@/routes/admin/employees';
import { commit, preview, template } from '@/routes/admin/employees/import';

/** Admin › Karyawan › Impor: template → upload → dry run → commit (desktop). */
export default function EmployeeImport(props: EmployeeImportProps) {
    const breakpoint = useBreakpoint();

    return (
        <>
            <Head title="Impor karyawan" />
            {breakpoint === 'mobile' ? (
                <div className="space-y-4">
                    <DesktopOnlyNotice feature="Impor karyawan" />
                    <Button variant="outline" className="h-11 w-full" asChild>
                        <Link href={index()}>
                            <ArrowLeft />
                            Kembali ke daftar karyawan
                        </Link>
                    </Button>
                </div>
            ) : (
                <ImportDesktop {...props} />
            )}
        </>
    );
}

EmployeeImport.layout = {
    breadcrumbs: [
        { title: 'Admin', href: index() },
        { title: 'Karyawan', href: index() },
        { title: 'Impor', href: importMethod() },
    ],
    title: 'Impor karyawan',
    back: '/admin/karyawan',
};

const COLUMN_HELP: Record<string, string> = {
    nama: 'Nama lengkap.',
    email: 'Email Google kantor. Menjadi kunci: email yang sudah terdaftar akan diperbarui.',
    nomor_karyawan: 'Nomor induk karyawan (unik).',
    divisi: 'Kode atau nama divisi, mis. OPS.',
    tim: 'Nama atau kode tim di divisi tersebut.',
    jabatan: 'Nama jabatan persis seperti di master jabatan.',
    atasan_email:
        'Email atasan langsung; boleh karyawan baru di berkas yang sama.',
    mode_kerja: 'Kantor, Hybrid, WFH, atau Lapangan.',
    peran: 'Pisahkan dengan koma, mis. anggota, kepala_divisi.',
    tanggal_bergabung: 'Format YYYY-MM-DD (atau tanggal Excel).',
    telepon: 'Nomor WhatsApp, mis. +62 812 3456 7890.',
    nik: '16 digit sesuai KTP. Disimpan terenkripsi.',
};

function ImportDesktop({
    token,
    fileName,
    preview: report,
    result,
    expired,
    reference,
}: EmployeeImportProps) {
    const upload = useForm<{ file: File | null }>({ file: null });
    const [committing, setCommitting] = useState(false);

    return (
        <div className="mx-auto max-w-5xl space-y-5">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-xl leading-7 font-semibold text-text">
                        Impor karyawan
                    </h1>
                    <p className="text-[13px] text-text-muted">
                        Periksa dulu (tanpa menulis data), lalu impor baris yang
                        valid. Baris galat dilewati.
                    </p>
                </div>
                <Button variant="outline" asChild>
                    <Link href={index()}>
                        <ArrowLeft />
                        Daftar karyawan
                    </Link>
                </Button>
            </header>

            {expired && (
                <Notice tone="warning">
                    Sesi impor sudah kedaluwarsa atau bukan milik Anda. Unggah
                    ulang berkasnya.
                </Notice>
            )}

            {result ? (
                <ResultPanel result={result} />
            ) : (
                <>
                    <section className="grid gap-5 lg:grid-cols-2">
                        <Step number={1} title="Unduh templat">
                            <p className="text-[13px] text-text-muted">
                                Kolom wajib:{' '}
                                <code className="font-mono">nama</code>,{' '}
                                <code className="font-mono">email</code> (@
                                {reference.companyDomain}). Sel kosong
                                mempertahankan nilai lama untuk karyawan yang
                                sudah ada.
                            </p>
                            <div className="flex gap-2">
                                <Button variant="outline" asChild>
                                    <a href={template.url('xlsx')}>
                                        <Download />
                                        Templat XLSX
                                    </a>
                                </Button>
                                <Button variant="outline" asChild>
                                    <a href={template.url('csv')}>
                                        <Download />
                                        Templat CSV
                                    </a>
                                </Button>
                            </div>
                        </Step>

                        <Step number={2} title="Unggah & periksa">
                            <form
                                className="space-y-3"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    upload.post(preview.url(), {
                                        forceFormData: true,
                                        onSuccess: () => upload.reset(),
                                    });
                                }}
                            >
                                <label
                                    htmlFor="import-file"
                                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border-strong px-4 py-4 text-sm hover:bg-surface-2/60"
                                >
                                    <FileSpreadsheet
                                        aria-hidden
                                        className="size-6 text-text-subtle"
                                        strokeWidth={1.75}
                                    />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-text">
                                            {upload.data.file?.name ??
                                                'Pilih berkas CSV atau XLSX'}
                                        </span>
                                        <span className="block text-xs text-text-muted">
                                            Maks.{' '}
                                            {formatNumber(
                                                reference.maxKilobytes / 1024,
                                            )}{' '}
                                            MB ·{' '}
                                            {formatNumber(reference.maxRows)}{' '}
                                            baris
                                        </span>
                                    </span>
                                    <input
                                        id="import-file"
                                        type="file"
                                        accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                        className="sr-only"
                                        onChange={(event) =>
                                            upload.setData(
                                                'file',
                                                event.target.files?.[0] ?? null,
                                            )
                                        }
                                    />
                                </label>
                                <InputError message={upload.errors.file} />
                                <Button
                                    type="submit"
                                    disabled={
                                        !upload.data.file || upload.processing
                                    }
                                >
                                    <Upload />
                                    {upload.processing
                                        ? 'Memeriksa…'
                                        : 'Periksa berkas'}
                                </Button>
                            </form>
                        </Step>
                    </section>

                    {report && token && (
                        <PreviewPanel
                            report={report}
                            fileName={fileName}
                            committing={committing}
                            onCommit={() =>
                                router.post(
                                    commit.url(token),
                                    {},
                                    {
                                        onStart: () => setCommitting(true),
                                        onFinish: () => setCommitting(false),
                                    },
                                )
                            }
                        />
                    )}

                    <ColumnReference reference={reference} />
                </>
            )}
        </div>
    );
}

function Step({
    number,
    title,
    children,
}: {
    number: number;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-3 rounded-lg border border-border bg-surface p-4 shadow-card">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-text">
                <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs text-primary tnum">
                    {number}
                </span>
                {title}
            </h2>
            {children}
        </div>
    );
}

function Notice({
    tone,
    children,
}: {
    tone: 'warning' | 'danger' | 'success';
    children: React.ReactNode;
}) {
    const Icon = tone === 'success' ? CheckCircle2 : AlertTriangle;

    return (
        <div
            role={tone === 'success' ? 'status' : 'alert'}
            className={cn(
                'flex items-start gap-2 rounded-lg px-4 py-3 text-sm',
                tone === 'warning' && 'bg-warning/10 text-warning',
                tone === 'danger' && 'bg-danger/10 text-danger',
                tone === 'success' && 'bg-success/10 text-success',
            )}
        >
            <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
            <div>{children}</div>
        </div>
    );
}

function SummaryTiles({ report }: { report: ImportReport }) {
    const tiles = [
        { label: 'Total baris', value: report.summary.total, tone: '' },
        { label: 'Baru', value: report.summary.create, tone: 'text-success' },
        {
            label: 'Diperbarui',
            value: report.summary.update,
            tone: 'text-info',
        },
        {
            label: 'Galat (dilewati)',
            value: report.summary.error,
            tone: report.summary.error > 0 ? 'text-danger' : '',
        },
    ];

    return (
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {tiles.map((tile) => (
                <div
                    key={tile.label}
                    className="rounded-lg border border-border bg-surface px-4 py-3"
                >
                    <dt className="text-xs text-text-muted">{tile.label}</dt>
                    <dd
                        className={cn(
                            'text-2xl font-semibold text-text tnum',
                            tile.tone,
                        )}
                    >
                        {formatNumber(tile.value)}
                    </dd>
                </div>
            ))}
        </dl>
    );
}

function PreviewPanel({
    report,
    fileName,
    committing,
    onCommit,
}: {
    report: ImportReport;
    fileName: string | null;
    committing: boolean;
    onCommit: () => void;
}) {
    const [errorsOnly, setErrorsOnly] = useState(report.summary.error > 0);
    const valid = report.summary.create + report.summary.update;
    const rows = errorsOnly
        ? report.rows.filter((row) => row.action === 'error')
        : report.rows;

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-text">
                    Pratinjau{' '}
                    {fileName && (
                        <span className="font-normal text-text-muted">
                            · {fileName}
                        </span>
                    )}
                </h2>
                <Button onClick={onCommit} disabled={valid === 0 || committing}>
                    {committing
                        ? 'Mengimpor…'
                        : `Impor ${formatNumber(valid)} baris valid`}
                </Button>
            </div>

            {report.fileErrors.map((message) => (
                <Notice key={message} tone="danger">
                    {message}
                </Notice>
            ))}

            {report.rows.length > 0 && (
                <>
                    <SummaryTiles report={report} />
                    <label className="flex w-fit items-center gap-2 text-sm text-text-muted">
                        <Checkbox
                            checked={errorsOnly}
                            onCheckedChange={(checked) =>
                                setErrorsOnly(checked === true)
                            }
                        />
                        Tampilkan hanya baris galat
                    </label>
                    <RowTable rows={rows} />
                </>
            )}
        </section>
    );
}

function ResultPanel({ result }: { result: ImportReport }) {
    const skipped = result.rows.filter((row) => row.action === 'error');

    return (
        <section className="space-y-4">
            <Notice tone="success">
                Impor selesai: {formatNumber(result.created)} karyawan
                ditambahkan, {formatNumber(result.updated)} diperbarui,{' '}
                {formatNumber(skipped.length)} baris dilewati.
            </Notice>
            {skipped.length > 0 && (
                <>
                    <h2 className="text-base font-semibold text-text">
                        Baris yang dilewati
                    </h2>
                    <RowTable rows={skipped} />
                </>
            )}
            <div className="flex gap-2">
                <Button asChild>
                    <Link href={index()}>Lihat daftar karyawan</Link>
                </Button>
                <Button variant="outline" asChild>
                    <Link href={importMethod()}>Impor berkas lain</Link>
                </Button>
            </div>
        </section>
    );
}

const ACTION_LABELS: Record<ImportRowResult['action'], string> = {
    create: 'Baru',
    update: 'Diperbarui',
    error: 'Galat',
};

function RowTable({ rows }: { rows: ImportRowResult[] }) {
    if (rows.length === 0) {
        return (
            <p className="rounded-lg border border-border bg-surface px-4 py-6 text-center text-sm text-text-muted">
                Tidak ada baris galat.
            </p>
        );
    }

    return (
        <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
            <div className="max-h-[60vh] overflow-auto">
                <table className="w-full text-[13px]">
                    <thead className="sticky top-0 bg-surface-2 text-left text-xs text-text-muted">
                        <tr>
                            <th
                                scope="col"
                                className="h-9 w-16 px-4 font-medium"
                            >
                                Baris
                            </th>
                            <th scope="col" className="px-4 font-medium">
                                Nama
                            </th>
                            <th scope="col" className="px-4 font-medium">
                                Email
                            </th>
                            <th scope="col" className="w-28 px-4 font-medium">
                                Hasil
                            </th>
                            <th scope="col" className="px-4 font-medium">
                                Keterangan
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr
                                key={row.row}
                                className="border-t border-border align-top"
                            >
                                <td className="px-4 py-2.5 font-mono text-text-muted tnum">
                                    {row.row}
                                </td>
                                <td className="px-4 py-2.5 text-text">
                                    {row.name ?? '—'}
                                </td>
                                <td className="px-4 py-2.5 break-all text-text-muted">
                                    {row.email ?? '—'}
                                </td>
                                <td className="px-4 py-2.5">
                                    <span
                                        className={cn(
                                            'inline-flex items-center gap-1.5',
                                            row.action === 'error'
                                                ? 'text-danger'
                                                : row.action === 'create'
                                                  ? 'text-success'
                                                  : 'text-info',
                                        )}
                                    >
                                        <span
                                            aria-hidden
                                            className="size-1.5 rounded-full bg-current"
                                        />
                                        {ACTION_LABELS[row.action]}
                                    </span>
                                </td>
                                <td className="px-4 py-2.5">
                                    {row.errors.length === 0 ? (
                                        <span className="text-text-subtle">
                                            —
                                        </span>
                                    ) : (
                                        <ul className="list-disc space-y-0.5 pl-4 text-danger">
                                            {row.errors.map((error) => (
                                                <li key={error}>{error}</li>
                                            ))}
                                        </ul>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function ColumnReference({
    reference,
}: {
    reference: EmployeeImportProps['reference'];
}) {
    return (
        <details className="group rounded-lg border border-border bg-surface shadow-card">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-text">
                Panduan kolom & nilai yang diterima
            </summary>
            <div className="grid gap-5 border-t border-border p-4 lg:grid-cols-[2fr_1fr]">
                <table className="w-full text-[13px]">
                    <tbody>
                        {reference.columns.map((column) => (
                            <tr
                                key={column}
                                className="border-b border-border last:border-b-0"
                            >
                                <th
                                    scope="row"
                                    className="w-44 py-2 pr-3 text-left align-top font-mono font-normal text-text"
                                >
                                    {column}
                                    {reference.required.includes(column) && (
                                        <span className="ml-1 text-danger">
                                            *
                                        </span>
                                    )}
                                </th>
                                <td className="py-2 text-text-muted">
                                    {COLUMN_HELP[column] ?? ''}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="space-y-4 text-[13px]">
                    <div>
                        <h3 className="mb-1 font-medium text-text">Divisi</h3>
                        <ul className="space-y-0.5 text-text-muted">
                            {reference.divisions.map((division) => (
                                <li key={division.code}>
                                    <code className="font-mono text-text">
                                        {division.code}
                                    </code>{' '}
                                    {division.name}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div>
                        <h3 className="mb-1 font-medium text-text">Peran</h3>
                        <p className="text-text-muted">
                            {reference.roles
                                .map((role) => role.value)
                                .join(', ')}
                        </p>
                    </div>
                    <div>
                        <h3 className="mb-1 font-medium text-text">Jabatan</h3>
                        <p className="text-text-muted">
                            {reference.positions.join(', ') || '—'}
                        </p>
                    </div>
                </div>
            </div>
        </details>
    );
}
