import { dayUnit, formatDateRange, formatDays } from '@/lib/requests';
import { cn } from '@/lib/utils';
import type { BalanceCard } from '@/types/requests';

/** "Jatah 12 + bawaan 2 · terpakai 5" (how the total is made up). */
function breakdown(card: BalanceCard): string {
    const b = card.balance;

    if (!b) {
        return '';
    }

    return [
        `Jatah ${formatDays(b.entitled)}`,
        b.carried_over > 0 ? ` + bawaan ${formatDays(b.carried_over)}` : '',
        b.opening > 0 ? ` + saldo awal ${formatDays(b.opening)}` : '',
        b.adjustments !== 0
            ? ` ${b.adjustments > 0 ? '+' : '−'} penyesuaian ${formatDays(Math.abs(b.adjustments))}`
            : '',
    ].join('');
}

/**
 * Highlight balance card (SPengajuan / MSPengajuanSaya "Cuti tahunan 2026"):
 * gradient aksi, "7 dari 12 hari", used · pending · remaining bar.
 */
function HighlightBalance({
    card,
    className,
}: {
    card: BalanceCard;
    className?: string;
}) {
    const b = card.balance!;
    const total = Math.max(b.total, 0.0001);
    const pct = (value: number) =>
        `${Math.max(0, Math.min(100, (value / total) * 100))}%`;
    const free = Math.max(0, b.remaining - b.pending);

    return (
        <section
            aria-label={`${card.type.name} ${card.year}`}
            className={cn(
                'flex min-w-0 flex-col gap-2.5 rounded-[22px] bg-primary bg-grad-highlight px-[18px] py-[18px] text-on-brand shadow-glow md:px-6 md:py-[22px]',
                className,
            )}
        >
            <h2 className="text-[15px] font-bold md:text-[16px] md:font-semibold">
                {card.type.name} {card.year}
            </h2>
            <p className="text-[36px] leading-10 font-extrabold tnum md:text-[44px] md:leading-[50px]">
                {formatDays(b.remaining)}{' '}
                <span className="text-[17px] font-semibold md:text-[20px]">
                    dari {formatDays(b.total)} hari
                </span>
            </p>
            <div
                aria-hidden
                className="flex h-2 overflow-hidden rounded-full bg-on-brand/25 md:h-2.5"
            >
                <span
                    className="h-full bg-on-brand/45"
                    style={{ width: pct(b.used) }}
                />
                <span
                    className="h-full bg-warning-soft"
                    style={{ width: pct(b.pending) }}
                />
                <span
                    className="h-full bg-on-brand"
                    style={{ width: pct(free) }}
                />
            </div>
            <p className="text-[14px] md:text-[15px]">
                {formatDays(b.used)} terpakai
                {b.pending > 0
                    ? ` · ${formatDays(b.pending)} menunggu persetujuan`
                    : ''}{' '}
                · {breakdown(card)}
            </p>
            {card.pending_request && (
                <p className="text-[14px] md:text-[15px]">
                    Menjadi{' '}
                    <strong className="font-bold">
                        {formatDays(b.remaining - b.pending)} hari
                    </strong>{' '}
                    bila pengajuan{' '}
                    {formatDateRange(
                        card.pending_request.start_at,
                        card.pending_request.end_at,
                    )}{' '}
                    disetujui
                </p>
            )}
        </section>
    );
}

/** White card: label, value, note (SPengajuan "Sakit · 0 hari"). */
function PlainBalance({
    card,
    className,
}: {
    card: BalanceCard;
    className?: string;
}) {
    const b = card.balance;
    let value: string;
    let notes: string[] = [];

    if (card.kind === 'balance' && b) {
        value = `${formatDays(b.remaining)} hari`;
        notes = [
            `tersisa dari ${formatDays(b.total)} · terpakai ${formatDays(b.used)}`,
        ];
    } else if (card.kind === 'ineligible') {
        value = 'Belum berhak';
        notes = [
            'Sesuai peraturan perusahaan, dihitung dari masa kerja. Tanyakan HR untuk rinciannya.',
        ];
    } else {
        value = 'Tidak memotong cuti';
        if (card.type.max_days_per_request != null) {
            notes.push(
                `Maks. ${formatDays(card.type.max_days_per_request)} ${dayUnit(card.type)} per pengajuan`,
            );
        }
        if (!card.type.is_paid) {
            notes.push('Tidak dibayar');
        }
        if (card.type.requires_attachment_after_days !== null) {
            notes.push(
                card.type.requires_attachment_after_days === 0
                    ? 'Lampiran wajib'
                    : `${card.type.category === 'sick' ? 'Surat dokter' : 'Lampiran'} wajib bila lebih dari ${card.type.requires_attachment_after_days} hari`,
            );
        }
    }

    return (
        <section
            aria-label={card.type.name}
            className={cn(
                'flex min-w-0 flex-col gap-1.5 rounded-[22px] border border-border bg-surface px-[18px] py-[18px] shadow-card md:px-6 md:py-[22px]',
                className,
            )}
        >
            <h2 className="text-[15px] font-semibold text-text-muted md:text-[16px]">
                {card.type.name}
                {card.kind === 'balance' ? ` ${card.year}` : ''}
            </h2>
            <p
                className={cn(
                    'font-bold text-text tnum',
                    value.length > 10
                        ? 'text-[22px] leading-[30px]'
                        : 'text-[28px] leading-9 md:text-[32px] md:leading-10',
                )}
            >
                {value}
            </p>
            {notes.map((note) => (
                <p
                    key={note}
                    className="text-[14px] leading-5 text-text-muted md:text-[15px] md:leading-[22px]"
                >
                    {note}
                </p>
            ))}
        </section>
    );
}

/**
 * Cards above "Pengajuan saya": yearly balance (the first one with a quota is
 * the gradient highlight), eligibility, sick-leave rule.
 */
export function BalanceCardView({
    card,
    highlight = false,
    className,
}: {
    card: BalanceCard;
    highlight?: boolean;
    className?: string;
}) {
    return highlight && card.kind === 'balance' && card.balance ? (
        <HighlightBalance card={card} className={className} />
    ) : (
        <PlainBalance card={card} className={className} />
    );
}

/** Index of the card shown as highlight (first card with a quota), or -1. */
export function highlightIndex(cards: BalanceCard[]): number {
    return cards.findIndex(
        (card) => card.kind === 'balance' && card.balance !== null,
    );
}
