import { useForm } from '@inertiajs/react';
import { Clock } from 'lucide-react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import windowRoutes from '@/routes/admin/attendance/windows';
import { SectionCard } from './section-card';
import type { AttendanceSettingsProps } from './types';

type Props = Pick<AttendanceSettingsProps, 'windows'>;

type FieldKey =
    | 'check_in_from'
    | 'check_in_until'
    | 'check_out_from'
    | 'check_out_until';

const GROUPS = [
    {
        id: 'masuk',
        title: 'Absen masuk',
        hint: 'Kosong pada "Dari jam" = ikut jendela check-in shift (bila ada).',
        from: 'check_in_from',
        until: 'check_in_until',
    },
    {
        id: 'pulang',
        title: 'Absen pulang',
        hint: 'Di luar rentang ini tombol absen pulang ditolak; HR tetap bisa mengoreksi.',
        from: 'check_out_from',
        until: 'check_out_until',
    },
] as const satisfies readonly {
    id: string;
    title: string;
    hint: string;
    from: FieldKey;
    until: FieldKey;
}[];

/**
 * "Jam absen" (keputusan pemilik 13 Okt 2026): one company-wide range for
 * check-in and one for check-out. Every field is optional; empty = no limit.
 */
export function WindowsSection({ windows }: Props) {
    const form = useForm<Record<FieldKey, string>>({
        check_in_from: windows.checkIn.from ?? '',
        check_in_until: windows.checkIn.until ?? '',
        check_out_from: windows.checkOut.from ?? '',
        check_out_until: windows.checkOut.until ?? '',
    });

    return (
        <SectionCard
            id="jam-absen"
            title="Jam absen"
            description="Rentang jam karyawan boleh absen masuk dan absen pulang. Berlaku untuk semua karyawan, juga yang belum punya shift."
        >
            <form
                className="flex flex-col gap-5 px-6 py-6 md:px-7"
                onSubmit={(event) => {
                    event.preventDefault();
                    form.put(windowRoutes.update.url(), {
                        preserveScroll: true,
                    });
                }}
            >
                <div className="grid gap-4 md:grid-cols-2">
                    {GROUPS.map((group) => (
                        <fieldset
                            key={group.id}
                            className="flex min-w-0 flex-col gap-3 rounded-card border border-border bg-background/60 p-5"
                        >
                            <legend className="sr-only">{group.title}</legend>
                            <div className="flex items-center justify-between gap-3">
                                <p
                                    className="flex items-center gap-2 text-[16px] font-semibold text-text"
                                    aria-hidden
                                >
                                    <Clock
                                        className="size-5 text-link"
                                        strokeWidth={1.75}
                                    />
                                    {group.title}
                                </p>
                                <Button
                                    type="button"
                                    variant="quiet"
                                    size="sm"
                                    disabled={
                                        form.data[group.from] === '' &&
                                        form.data[group.until] === ''
                                    }
                                    onClick={() =>
                                        form.setData({
                                            ...form.data,
                                            [group.from]: '',
                                            [group.until]: '',
                                        })
                                    }
                                >
                                    Kosongkan
                                </Button>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label htmlFor={`jam-${group.from}`}>
                                        {group.title}: dari jam
                                    </Label>
                                    <Input
                                        id={`jam-${group.from}`}
                                        type="time"
                                        value={form.data[group.from]}
                                        onChange={(event) =>
                                            form.setData(
                                                group.from,
                                                event.target.value,
                                            )
                                        }
                                        aria-invalid={
                                            form.errors[group.from]
                                                ? true
                                                : undefined
                                        }
                                        className="font-mono"
                                    />
                                    <InputError
                                        message={form.errors[group.from]}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor={`jam-${group.until}`}>
                                        {group.title}: sampai jam
                                    </Label>
                                    <Input
                                        id={`jam-${group.until}`}
                                        type="time"
                                        value={form.data[group.until]}
                                        onChange={(event) =>
                                            form.setData(
                                                group.until,
                                                event.target.value,
                                            )
                                        }
                                        aria-invalid={
                                            form.errors[group.until]
                                                ? true
                                                : undefined
                                        }
                                        className="font-mono"
                                    />
                                    <InputError
                                        message={form.errors[group.until]}
                                    />
                                </div>
                            </div>
                            <p className="text-meta text-text-muted">
                                {group.hint}
                            </p>
                        </fieldset>
                    ))}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="max-w-2xl text-meta text-text-muted">
                        Kosongkan = tanpa batas. Jam memakai zona waktu kantor
                        (24 jam) dan batasnya ikut dihitung, mis. sampai 12.00
                        masih bisa absen pukul 12.00. Shift lintas tengah malam
                        tidak dibatasi.
                    </p>
                    <Button
                        type="submit"
                        disabled={form.processing || !form.isDirty}
                    >
                        Simpan jam absen
                    </Button>
                </div>
            </form>
        </SectionCard>
    );
}
