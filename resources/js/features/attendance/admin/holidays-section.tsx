import { router, useForm } from '@inertiajs/react';
import { CalendarDays, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { DateInput } from '@/components/ui/date-input';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { index as settingsIndex } from '@/routes/admin/attendance';
import holidayRoutes from '@/routes/admin/attendance/holidays';
import { SectionCard } from './section-card';
import type { AttendanceSettingsProps } from './types';
import { workDateLabel } from './types';

type Props = Pick<
    AttendanceSettingsProps,
    'holidays' | 'holidayYear' | 'holidayYears' | 'holidayTypes'
>;

type ImportError = { line: number; message: string };

const UPCOMING = 'upcoming';

/** Holidays: list per year, quick add row and CSV import (mockup LokasiShift "Hari libur"). */
export function HolidaysSection({
    holidays,
    holidayYear,
    holidayYears,
    holidayTypes,
}: Props) {
    const fileInput = useRef<HTMLInputElement>(null);
    const [importErrors, setImportErrors] = useState<ImportError[]>([]);
    const [importError, setImportError] = useState<string | null>(null);
    const [importing, setImporting] = useState(false);
    const form = useForm({ date: '', name: '', type: 'national' });

    const upload = (file: File) => {
        setImporting(true);
        setImportErrors([]);
        setImportError(null);
        router.post(
            holidayRoutes.import.url(),
            { file },
            {
                forceFormData: true,
                preserveScroll: true,
                onFlash: (flash) => {
                    const data = (
                        flash as { holidayImport?: { errors: ImportError[] } }
                    ).holidayImport;
                    setImportErrors(data?.errors ?? []);
                },
                onError: (errors) => setImportError(errors.file ?? null),
                onFinish: () => setImporting(false),
            },
        );
    };

    return (
        <SectionCard
            id="hari-libur"
            title="Hari libur"
            description="Tidak dihitung sebagai hari kerja untuk absensi dan saldo cuti."
            actions={
                <>
                    <Select
                        value={holidayYear ? String(holidayYear) : UPCOMING}
                        onValueChange={(value) =>
                            router.get(
                                settingsIndex.url({
                                    query:
                                        value === UPCOMING
                                            ? {}
                                            : { tahun: value },
                                }),
                                {},
                                {
                                    preserveScroll: true,
                                    only: ['holidays', 'holidayYear'],
                                },
                            )
                        }
                    >
                        <SelectTrigger
                            className="w-44"
                            aria-label="Tampilkan tahun"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={UPCOMING}>Mendatang</SelectItem>
                            {holidayYears.map((year) => (
                                <SelectItem key={year} value={String(year)}>
                                    Tahun {year}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={importing}
                        onClick={() => fileInput.current?.click()}
                    >
                        <Upload aria-hidden />
                        Impor CSV
                    </Button>
                    <input
                        ref={fileInput}
                        type="file"
                        accept=".csv,text/csv"
                        className="sr-only"
                        tabIndex={-1}
                        aria-hidden
                        onChange={(event) => {
                            const file = event.target.files?.[0];

                            if (file) {
                                upload(file);
                            }

                            event.target.value = '';
                        }}
                    />
                </>
            }
        >
            {(importError || importErrors.length > 0) && (
                <div
                    role="alert"
                    className="border-b border-divider bg-danger-soft px-6 py-3.5 text-[15px] md:px-7"
                >
                    <p className="font-medium text-danger">
                        {importError ?? 'Impor dibatalkan.'}
                    </p>
                    <ul className="mt-1 space-y-0.5 text-text">
                        {importErrors.map((error) => (
                            <li key={`${error.line}-${error.message}`}>
                                Baris {error.line}: {error.message}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            <ul className="divide-y divide-divider">
                {holidays.map((holiday) => (
                    <li
                        key={holiday.id}
                        className="flex min-h-16 items-center gap-4 px-6 py-2.5 md:px-7"
                    >
                        <CalendarDays
                            className="size-5 shrink-0 text-link"
                            strokeWidth={1.75}
                            aria-hidden
                        />
                        <span className="w-36 shrink-0 text-[15px] font-semibold text-text">
                            {workDateLabel(holiday.date)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[16px] text-text">
                            {holiday.name}
                        </span>
                        <span className="inline-flex h-6 items-center rounded-sm bg-info-soft px-2 text-[13px] font-semibold text-info">
                            {holiday.typeLabel}
                        </span>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-text-muted"
                            aria-label={`Hapus ${holiday.name}`}
                            onClick={() =>
                                window.confirm(`Hapus ${holiday.name}?`) &&
                                router.delete(
                                    holidayRoutes.destroy.url(holiday.id),
                                    { preserveScroll: true },
                                )
                            }
                        >
                            <Trash2 aria-hidden />
                        </Button>
                    </li>
                ))}
                {holidays.length === 0 && (
                    <li className="px-6 py-4 text-[15px] text-text-muted md:px-7">
                        Belum ada hari libur pada periode ini.
                    </li>
                )}
                <li className="bg-background/60 px-6 py-4 md:px-7">
                    <form
                        className="flex flex-wrap items-start gap-2"
                        onSubmit={(event) => {
                            event.preventDefault();
                            form.post(holidayRoutes.store.url(), {
                                preserveScroll: true,
                                onSuccess: () => form.reset(),
                            });
                        }}
                    >
                        <CalendarDays
                            className="mt-3 size-5 shrink-0 text-text-subtle"
                            aria-hidden
                        />
                        <div className="w-60">
                            <DateInput
                                aria-label="Tanggal"
                                clearable={false}
                                value={form.data.date}
                                onChange={(value) =>
                                    form.setData('date', value)
                                }
                            />
                            <InputError message={form.errors.date} />
                        </div>
                        <div className="min-w-48 flex-1">
                            <Input
                                aria-label="Nama hari libur"
                                placeholder="Nama hari libur, mis. Cuti bersama Natal"
                                value={form.data.name}
                                onChange={(e) =>
                                    form.setData('name', e.target.value)
                                }
                            />
                            <InputError message={form.errors.name} />
                        </div>
                        <Select
                            value={form.data.type}
                            onValueChange={(value) =>
                                form.setData('type', value)
                            }
                        >
                            <SelectTrigger className="w-44" aria-label="Jenis">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {holidayTypes.map((type) => (
                                    <SelectItem
                                        key={type.value}
                                        value={type.value}
                                    >
                                        {type.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button
                            type="submit"
                            size="sm"
                            disabled={form.processing}
                        >
                            Tambah
                        </Button>
                    </form>
                </li>
            </ul>
            <p className="border-t border-divider px-6 py-3.5 text-meta text-text-muted md:px-7">
                Format CSV:{' '}
                <span className="font-mono">tanggal,nama,jenis</span> (jenis:
                nasional · cuti bersama · perusahaan). Tanggal YYYY-MM-DD atau
                DD/MM/YYYY.
            </p>
        </SectionCard>
    );
}
