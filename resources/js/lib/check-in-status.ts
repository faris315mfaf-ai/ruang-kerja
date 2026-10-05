import type { StatusTone } from '@/lib/attendance';
import { formatTime } from '@/lib/format';
import type { AttendanceStatusSummary } from '@/types/attendance';

export type ShellStatus = {
    title: string;
    detail: string;
    tone: StatusTone;
    /** Topbar button: what it does, or null to hide it. */
    button: {
        label: 'Check-in' | 'Check-out';
        variant: 'default' | 'outline';
    } | null;
};

/**
 * Sidebar widget + topbar button text from the shared attendance status
 * (mockup Main: "Sudah check-in · Masuk 07.41 · Kantor Pusat").
 */
export function shellStatus(
    status: AttendanceStatusSummary | null | undefined,
): ShellStatus {
    if (!status) {
        return {
            title: 'Absensi',
            detail: 'Buka halaman absensi',
            tone: 'neutral',
            button: { label: 'Check-in', variant: 'default' },
        };
    }

    const place = status.isRemote ? 'WFH/lapangan' : status.locationName;

    switch (status.action) {
        case 'check_out':
            return {
                title:
                    status.status === 'late'
                        ? `Terlambat ${status.lateMinutes}m`
                        : 'Sudah check-in',
                detail: [`Masuk ${formatTime(status.checkInAt)}`, place]
                    .filter(Boolean)
                    .join(' · '),
                tone: status.status === 'late' ? 'warning' : 'success',
                button: { label: 'Check-out', variant: 'outline' },
            };
        case 'done':
            return {
                title: 'Sudah check-out',
                detail: `${formatTime(status.checkInAt)} – ${formatTime(status.checkOutAt)}`,
                tone: 'success',
                button: null,
            };
        case 'unavailable':
            return {
                title: status.statusLabel ?? 'Tidak masuk',
                detail: 'Tercatat dari pengajuan',
                tone: 'info',
                button: null,
            };
        case 'check_in':
            if (status.isHoliday) {
                return {
                    title: 'Hari libur',
                    detail: 'Check-in tetap bisa dicatat',
                    tone: 'neutral',
                    button: { label: 'Check-in', variant: 'outline' },
                };
            }

            return {
                title: 'Belum check-in',
                detail: status.startLabel
                    ? `Jadwal masuk ${status.startLabel}${status.shiftName ? ` · ${status.shiftName}` : ''}`
                    : 'Tidak ada jadwal hari ini',
                tone: 'neutral',
                button: { label: 'Check-in', variant: 'default' },
            };
    }
}
