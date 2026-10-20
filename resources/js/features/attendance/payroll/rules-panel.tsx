import { router } from '@inertiajs/react';
import { useEffect, useId, useState } from 'react';
import type { ReactNode } from 'react';
import InputError from '@/components/input-error';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import payrollRoutes from '@/routes/attendance/payroll';
import { formatRupiahInput, parseRupiahInput } from './payroll';
import type { PayrollRules } from './types';

type Props = {
    rules: PayrollRules;
    /** HR / Super Admin: may change; Direksi reads only. */
    canManage: boolean;
    /** Locked month: the numbers are a snapshot, rules can't move them. */
    locked: boolean;
    reload: string[];
    className?: string;
};

const TOGGLES: {
    key: 'pay_leave' | 'pay_sick' | 'pay_permit';
    label: string;
}[] = [
    { key: 'pay_leave', label: 'Cuti dibayar' },
    { key: 'pay_sick', label: 'Sakit dibayar' },
    { key: 'pay_permit', label: 'Izin dibayar' },
];

/**
 * "Aturan hitung" aside (mockup Gaji.dc.html): company-wide pay rules,
 * saved on change (optimistic, reverted when the server refuses).
 */
export function RulesPanel({
    rules,
    canManage,
    locked,
    reload,
    className,
}: Props) {
    const [draft, setDraft] = useState(rules);
    const [deduction, setDeduction] = useState(
        formatRupiahInput(rules.late_deduction),
    );
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const id = useId();
    const disabled = !canManage || saving;

    useEffect(() => {
        setDraft(rules);
        setDeduction(formatRupiahInput(rules.late_deduction));
    }, [rules]);

    const save = (next: PayrollRules) => {
        const previous = draft;

        setDraft(next);
        setError(null);
        setSaving(true);
        router.put(payrollRoutes.rules.update.url(), next, {
            preserveScroll: true,
            preserveState: true,
            only: reload,
            onError: (errors) => {
                setDraft(previous);
                setDeduction(formatRupiahInput(previous.late_deduction));
                setError(
                    Object.values(errors)[0] ?? 'Aturan gaji gagal disimpan.',
                );
            },
            onFinish: () => setSaving(false),
        });
    };

    const commitDeduction = () => {
        const value = parseRupiahInput(deduction) ?? 0;

        setDeduction(formatRupiahInput(value));

        if (value !== draft.late_deduction) {
            save({ ...draft, late_deduction: value });
        }
    };

    return (
        <aside
            aria-label="Aturan hitung"
            className={cn(
                'flex flex-col gap-4 rounded-panel border border-border bg-surface p-6 shadow-card',
                className,
            )}
        >
            <div className="flex flex-col gap-1">
                <h2 className="text-title text-text">Aturan hitung</h2>
                <p className="text-[15px] leading-[22px] text-text-muted">
                    Berlaku untuk semua pegawai perusahaan ini.{' '}
                    {canManage
                        ? 'Hanya HR yang bisa mengubah.'
                        : 'Direksi hanya melihat; HR yang mengubah.'}
                </p>
            </div>
            <ul className="flex flex-col divide-y divide-divider">
                <RuleRow label="Hadir, terlambat, WFH, dinas">
                    <span className="text-[14px] font-semibold whitespace-nowrap text-success">
                        selalu dibayar
                    </span>
                </RuleRow>
                {TOGGLES.map((toggle) => (
                    <RuleRow
                        key={toggle.key}
                        label={toggle.label}
                        htmlFor={`${id}-${toggle.key}`}
                    >
                        <Switch
                            id={`${id}-${toggle.key}`}
                            checked={draft[toggle.key]}
                            disabled={disabled}
                            onCheckedChange={(checked) =>
                                save({ ...draft, [toggle.key]: checked })
                            }
                        />
                    </RuleRow>
                ))}
                <RuleRow label="Alpha">
                    <span className="text-[14px] font-semibold whitespace-nowrap text-danger">
                        tidak dibayar
                    </span>
                </RuleRow>
                <li className="flex flex-col gap-2 py-3">
                    <label
                        htmlFor={`${id}-late`}
                        className="text-[15px] font-semibold text-text"
                    >
                        Potongan per terlambat
                    </label>
                    <div className="relative">
                        <span
                            aria-hidden
                            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[15px] font-semibold text-text-muted"
                        >
                            Rp
                        </span>
                        <Input
                            id={`${id}-late`}
                            inputMode="numeric"
                            value={deduction}
                            disabled={disabled}
                            onChange={(event) =>
                                setDeduction(
                                    formatRupiahInput(
                                        parseRupiahInput(event.target.value),
                                    ),
                                )
                            }
                            onBlur={commitDeduction}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    commitDeduction();
                                }
                            }}
                            placeholder="0"
                            className="pl-11 font-mono"
                            aria-describedby={`${id}-late-hint`}
                        />
                    </div>
                    <p
                        id={`${id}-late-hint`}
                        className="text-meta text-text-muted"
                    >
                        Isi 0 bila keterlambatan tidak dipotong.
                    </p>
                </li>
            </ul>
            <InputError message={error ?? undefined} />
            <div className="rounded-lg bg-surface-2 px-4 py-3 text-[14px] leading-5 text-text-muted">
                Hari "Perlu koreksi" dan hari ini yang belum check-in belum
                dihitung sampai HR menetapkan statusnya.
            </div>
            <div className="rounded-lg bg-warning-soft px-4 py-3 text-[14px] leading-5 text-text">
                {locked
                    ? 'Periode ini terkunci: angka di tabel adalah salinan saat dikunci, perubahan aturan berlaku setelah kunci dibuka.'
                    : 'Setelah "Kunci periode", absen bulan ini tidak bisa diubah tanpa membuka kunci (tercatat di audit log).'}
            </div>
        </aside>
    );
}

function RuleRow({
    label,
    htmlFor,
    children,
}: {
    label: string;
    htmlFor?: string;
    children: ReactNode;
}) {
    return (
        <li className="flex min-h-12 items-center justify-between gap-3 py-2">
            {htmlFor ? (
                <label
                    htmlFor={htmlFor}
                    className="text-[15px] font-semibold text-text"
                >
                    {label}
                </label>
            ) : (
                <span className="text-[15px] font-semibold text-text">
                    {label}
                </span>
            )}
            {children}
        </li>
    );
}
