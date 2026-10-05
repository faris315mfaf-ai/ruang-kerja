import { CircleAlert } from 'lucide-react';
import { dayUnit, formatDateRange, formatDays } from '@/lib/requests';
import { cn } from '@/lib/utils';
import type { BalanceCard } from '@/types/requests';

/** Cards above "Pengajuan saya": yearly balance, eligibility, sick-leave rule. */
export function BalanceCardView({
    card,
    className,
}: {
    card: BalanceCard;
    className?: string;
}) {
    const balance = card.balance;

    return (
        <section
            className={cn(
                'rounded-xl border border-border bg-surface p-4 shadow-card',
                className,
            )}
            aria-label={card.type.name}
        >
            <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] text-text">{card.type.name}</p>
                {card.kind === 'balance' && (
                    <span className="rounded-full bg-info-soft px-2 py-0.5 text-xs text-info tnum">
                        {card.year}
                    </span>
                )}
            </div>

            {card.kind === 'balance' && balance && (
                <>
                    <p className="mt-2 text-text">
                        <span className="text-[28px] leading-9 font-semibold tnum">
                            {formatDays(balance.remaining)}
                        </span>{' '}
                        <span className="text-sm text-text-muted">
                            hari tersisa
                        </span>
                    </p>
                    <div
                        className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-surface-2"
                        aria-hidden
                    >
                        <span
                            className="h-full bg-text-subtle"
                            style={{
                                width: `${(balance.used / Math.max(balance.total, 0.0001)) * 100}%`,
                            }}
                        />
                        <span
                            className="h-full bg-success"
                            style={{
                                width: `${(balance.remaining / Math.max(balance.total, 0.0001)) * 100}%`,
                            }}
                        />
                    </div>
                    <p className="mt-2 text-[13px] text-text-muted">
                        Jatah {formatDays(balance.entitled)}
                        {balance.carried_over > 0
                            ? ` + bawaan ${formatDays(balance.carried_over)}`
                            : ''}
                        {balance.opening > 0
                            ? ` + saldo awal ${formatDays(balance.opening)}`
                            : ''}
                        {balance.adjustments !== 0
                            ? ` ${balance.adjustments > 0 ? '+' : '−'} penyesuaian ${formatDays(Math.abs(balance.adjustments))}`
                            : ''}{' '}
                        · terpakai {formatDays(balance.used)}
                    </p>
                    {card.pending_request && (
                        <p className="text-[13px] text-text-muted">
                            Menjadi{' '}
                            <strong className="text-text">
                                {formatDays(
                                    balance.remaining - balance.pending,
                                )}{' '}
                                hari
                            </strong>{' '}
                            bila pengajuan{' '}
                            {formatDateRange(
                                card.pending_request.start_at,
                                card.pending_request.end_at,
                            )}{' '}
                            disetujui
                        </p>
                    )}
                </>
            )}

            {card.kind === 'ineligible' && (
                <>
                    <p className="mt-2 text-lg font-semibold text-text">
                        Belum berhak
                    </p>
                    <p className="mt-1 text-[13px] text-text-muted">
                        Sesuai peraturan perusahaan, dihitung dari masa kerja.
                        Tanyakan HR untuk rinciannya.
                    </p>
                </>
            )}

            {card.kind === 'info' && (
                <>
                    <p className="mt-2 text-lg font-semibold text-text">
                        Tidak memotong cuti
                    </p>
                    {card.type.max_days_per_request != null && (
                        <p className="mt-1 text-[13px] text-text-muted">
                            Maks. {formatDays(card.type.max_days_per_request)}{' '}
                            {dayUnit(card.type)} per pengajuan
                        </p>
                    )}
                    {!card.type.is_paid && (
                        <p className="mt-1 text-[13px] text-text-muted">
                            Tidak dibayar
                        </p>
                    )}
                    {card.type.requires_attachment_after_days !== null && (
                        <p className="mt-1 flex items-center gap-1.5 text-[13px] text-warning">
                            <CircleAlert className="size-3.5" aria-hidden />
                            {card.type.requires_attachment_after_days === 0
                                ? 'Lampiran wajib'
                                : `${card.type.category === 'sick' ? 'Surat dokter' : 'Lampiran'} wajib bila > ${card.type.requires_attachment_after_days} hari`}
                        </p>
                    )}
                </>
            )}
        </section>
    );
}
