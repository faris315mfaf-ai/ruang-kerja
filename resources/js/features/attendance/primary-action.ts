import { checkInTiming } from '@/lib/attendance';
import { formatTime } from '@/lib/format';
import type { CheckMethod, TodayAttendance } from '@/types/attendance';
import type { CheckType } from './use-check-flow';

export type PrimaryAction = {
    label: string;
    type: CheckType | null;
    disabled: boolean;
    /** Why the action is closed by the company hours (full sentence), if so. */
    notice?: string;
};

/**
 * Check-in / check-out closed by the company "jam absen": a short button
 * label plus the server's full sentence as `notice`.
 */
function blockedAction(today: TodayAttendance): PrimaryAction | null {
    if (today.action === 'check_in' && today.checkInBlocked) {
        const { code, message, opensAt } = today.checkInBlocked;
        const label =
            code === 'window_closed'
                ? 'Check-in sudah ditutup'
                : opensAt
                  ? `Check-in dibuka pukul ${formatTime(opensAt)}`
                  : 'Check-in belum dibuka';

        return { label, type: null, disabled: true, notice: message };
    }

    if (today.action === 'check_out' && today.checkOutBlockedReason) {
        return {
            label: 'Check-out di luar jam absen pulang',
            type: null,
            disabled: true,
            notice: today.checkOutBlockedReason,
        };
    }

    return null;
}

/** The single main action of the check-in card (docs/DESIGN.md §1.3). */
export function primaryAction(
    today: TodayAttendance,
    now: Date,
    method: CheckMethod = 'gps',
): PrimaryAction {
    const how = method === 'qr' ? 'Pindai QR' : 'Ambil selfie';
    const blocked = blockedAction(today);

    if (blocked) {
        return blocked;
    }

    switch (today.action) {
        case 'check_in': {
            const timing = checkInTiming(today.schedule, now);

            if (timing.tooEarly && today.schedule.checkInOpensAt) {
                return {
                    label: `Check-in dibuka pukul ${formatTime(today.schedule.checkInOpensAt)}`,
                    type: null,
                    disabled: true,
                };
            }

            return {
                label: `${how} & check-in`,
                type: 'in',
                disabled: false,
            };
        }
        case 'check_out':
            return {
                label: `${how} & check-out`,
                type: 'out',
                disabled: false,
            };
        case 'done':
            return {
                label: 'Absensi hari ini selesai',
                type: null,
                disabled: true,
            };
        case 'unavailable':
            return {
                label: `Hari ini tercatat ${today.day?.statusLabel ?? 'dari pengajuan'}`,
                type: null,
                disabled: true,
            };
    }
}
