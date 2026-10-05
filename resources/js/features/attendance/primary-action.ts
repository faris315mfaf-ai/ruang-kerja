import { checkInTiming } from '@/lib/attendance';
import { formatTime } from '@/lib/format';
import type { CheckMethod, TodayAttendance } from '@/types/attendance';
import type { CheckType } from './use-check-flow';

export type PrimaryAction = {
    label: string;
    type: CheckType | null;
    disabled: boolean;
};

/** The single main action of the check-in card (docs/DESIGN.md §1.3). */
export function primaryAction(
    today: TodayAttendance,
    now: Date,
    method: CheckMethod = 'gps',
): PrimaryAction {
    const how = method === 'qr' ? 'Pindai QR' : 'Ambil selfie';

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
