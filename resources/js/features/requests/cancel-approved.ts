import { formatDays, formatShortDate, officeDay } from '@/lib/requests';
import type { CancelPreview, RequestDetail } from '@/types/requests';

const MAX_DATES = 5;

/**
 * "12, 13, 14 Okt 2026" · "30 Sep, 1 Okt 2026" · "… dan 3 tanggal lain".
 * Dates are office dates (YYYY-MM-DD).
 */
export function formatDateList(dates: string[]): string {
    const days = [...new Set(dates)]
        .sort()
        .map((iso) => officeDay(iso))
        .filter((day) => day !== null);

    if (days.length === 0) {
        return '';
    }

    const shown = days.slice(0, MAX_DATES);
    const sameYear = shown.every((day) => day.year === shown[0].year);
    const groups: { key: string; label: (withYear: boolean) => string }[] = [];
    const byMonth = new Map<string, number[]>();

    for (const day of shown) {
        const key = `${day.year}-${day.month}`;
        const list = byMonth.get(key);

        if (list) {
            list.push(day.day);
        } else {
            byMonth.set(key, [day.day]);
            const [, month, year] = formatShortDate(day.iso).split(' ');
            groups.push({
                key,
                label: (withYear) =>
                    `${(byMonth.get(key) ?? []).join(', ')} ${month}${withYear ? ` ${year}` : ''}`,
            });
        }
    }

    const text = groups
        .map((group, index) =>
            group.label(!sameYear || index === groups.length - 1),
        )
        .join(', ');
    const rest = days.length - shown.length;

    return rest > 0 ? `${text} dan ${rest} tanggal lain` : text;
}

export type CancelEffects = {
    /** What changes, one sentence each. */
    effects: string[];
    /** Removed/restored dates that already passed (re-closed: no check-in = Alpha). */
    pastWarning: string | null;
    /** The server would refuse (corrected day changed since). */
    blocker: string | null;
};

/** Sentences for the "Batalkan pengajuan" confirm dialog (HR). */
export function cancelEffects(
    request: Pick<RequestDetail, 'type' | 'user'>,
    preview: CancelPreview,
): CancelEffects {
    const effects: string[] = [];
    const { attendance } = preview;

    if (preview.refund_days !== null && preview.refund_days > 0) {
        effects.push(
            `Saldo ${request.type.name.toLowerCase()} ${preview.balance_year ?? ''} dikembalikan ${formatDays(preview.refund_days)} hari.`.replace(
                /\s+/g,
                ' ',
            ),
        );
    }

    if (attendance.removed_dates.length > 0) {
        effects.push(
            `Catatan absensi ${formatDateList(attendance.removed_dates)} dihapus.`,
        );
    }

    if (attendance.unlinked_dates.length > 0) {
        effects.push(
            `Hari yang tetap masuk (${formatDateList(attendance.unlinked_dates)}) menjadi kehadiran biasa.`,
        );
    }

    if (attendance.overtime_date) {
        effects.push(
            `Menit lembur ${formatShortDate(attendance.overtime_date)} dihitung ulang tanpa pengajuan ini.`,
        );
    }

    if (attendance.correction_date && !preview.blocker) {
        effects.push(
            `Jam absensi ${formatShortDate(attendance.correction_date)} dikembalikan seperti sebelum koreksi.`,
        );
    }

    if (effects.length === 0) {
        effects.push('Tidak ada saldo atau catatan absensi yang berubah.');
    }

    effects.push(
        `${request.user.name} dan penyetuju diberi tahu. Alasan Anda hanya tampil di aplikasi.`,
    );

    // Only removed absences and restored corrections can turn into Alpha.
    const reclosed = new Set([
        ...attendance.removed_dates,
        ...(attendance.correction_date ? [attendance.correction_date] : []),
    ]);
    const past = preview.past_dates.filter((date) => reclosed.has(date));

    return {
        effects,
        pastWarning:
            past.length > 0 && !preview.blocker
                ? `${formatDateList(past)} sudah lewat. Absensinya dihitung ulang sekarang: tanpa check-in, hari itu menjadi Alpha.`
                : null,
        blocker: preview.blocker,
    };
}
