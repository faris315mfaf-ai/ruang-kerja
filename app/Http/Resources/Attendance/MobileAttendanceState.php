<?php

namespace App\Http\Resources\Attendance;

use App\Domain\Attendance\Support\OfficeClock;
use Carbon\CarbonImmutable;

/**
 * Explicit state of "today" for the Android app (GET /api/v1/absensi/hari-ini
 * `state`), derived from the MyAttendance::today() props — the same data the
 * web Absensi page uses — so every mockup state of docs/mockups/android/spec/
 * 03-absensi.md has a stable code instead of being inferred by the client.
 * Pure: the same arrays + clock always give the same answer.
 */
final class MobileAttendanceState
{
    /** Tab-bar centre button flips back to "Absen" this long before the shift ends (keputusan pemilik 9 Okt). */
    public const int CHECKOUT_PROMPT_MINUTES = 60;

    /**
     * @param  array<string, mixed>  $today  MyAttendance::today()
     * @param  array{granted: bool, version: string, needs_renewal: bool}  $consent
     * @return array<string, mixed>
     */
    public static function build(array $today, CarbonImmutable $now, array $consent): array
    {
        /** @var string $action */
        $action = $today['action'];
        /** @var array<string, mixed> $schedule */
        $schedule = $today['schedule'];
        /** @var array<string, mixed>|null $day */
        $day = $today['day'];
        /** @var list<mixed> $locations */
        $locations = $today['locations'];

        $opensAt = self::instant($schedule['checkInOpensAt'] ?? null);
        $end = self::instant($schedule['end'] ?? null);
        $remote = (bool) ($schedule['allowsRemote'] ?? false);
        $isWorkday = (bool) ($schedule['isWorkday'] ?? false);
        $tooEarly = $action === 'check_in' && $isWorkday && $opensAt !== null && $now->lt($opensAt);
        $noLocation = ! $remote && $locations === [];
        $lateMinutes = (int) ($day['lateMinutes'] ?? 0);

        $code = match (true) {
            $action === 'check_out' => 'checked_in',
            $action === 'done' => 'checked_out',
            $action === 'unavailable' => 'day_has_request',
            ! $isWorkday && (bool) ($schedule['isHoliday'] ?? false) => 'holiday',
            ! $isWorkday => 'non_working_day',
            $tooEarly => 'too_early',
            $noLocation => 'no_office_location',
            default => 'not_checked_in',
        };

        $punctuality = in_array($code, ['checked_in', 'checked_out'], true) ? ($lateMinutes > 0 ? 'late' : 'on_time') : null;
        $checkedInAt = self::instant($day['checkInAt'] ?? null);
        $checkedOutAt = self::instant($day['checkOutAt'] ?? null);
        $center = self::center($code, $now, $end);
        $request = self::request($day);

        return [
            'code' => $code,
            'label' => self::label($code, $punctuality),
            'message' => self::message($code, $schedule, $day, $lateMinutes, $opensAt, $checkedInAt, $checkedOutAt),
            'punctuality' => $punctuality,
            'lateMinutes' => in_array($code, ['checked_in', 'checked_out'], true) ? $lateMinutes : 0,
            'officeDate' => OfficeClock::local($now)->toDateString(),
            'workDate' => $schedule['workDate'] ?? null,
            'isWorkday' => $isWorkday,
            'isHoliday' => (bool) ($schedule['isHoliday'] ?? false),
            'holidayName' => $schedule['holidayName'] ?? null,
            'isRemote' => $remote,
            'isBusinessTrip' => ($day['status'] ?? null) === 'business_trip',
            'request' => $request,
            'scheduledStart' => $schedule['start'] ?? null,
            'scheduledEnd' => $schedule['end'] ?? null,
            'windowOpensAt' => $schedule['checkInOpensAt'] ?? null,
            'lateThreshold' => $schedule['lateThreshold'] ?? null,
            'checkedInAt' => $day['checkInAt'] ?? null,
            'checkedOutAt' => $day['checkOutAt'] ?? null,
            'locationName' => $day['checkIn']['locationName'] ?? null,
            'canCheckIn' => $action === 'check_in' && ! $tooEarly && ! $noLocation,
            'canCheckOut' => $action === 'check_out',
            'consent' => [
                'granted' => $consent['granted'],
                'needsRenewal' => $consent['needs_renewal'],
                'version' => $consent['version'],
            ],
            'center' => $center,
        ];
    }

    /**
     * The centre tab-bar button (keputusan pemilik 9 Okt): Absen before check-in;
     * Workspace after check-in; Absen again from end − 60 min (with a "!" badge)
     * until check-out; Workspace after check-out or when check-in is unavailable.
     * `flipsAt` is the instant the answer changes by itself (no polling needed).
     *
     * @return array{action: 'absen'|'workspace', badge: bool, flipsAt: string|null}
     */
    private static function center(string $code, CarbonImmutable $now, ?CarbonImmutable $end): array
    {
        if ($code === 'checked_in') {
            if ($end === null) {
                return ['action' => 'workspace', 'badge' => false, 'flipsAt' => null];
            }

            $flip = $end->subMinutes(self::CHECKOUT_PROMPT_MINUTES);

            return $now->gte($flip)
                ? ['action' => 'absen', 'badge' => true, 'flipsAt' => null]
                : ['action' => 'workspace', 'badge' => false, 'flipsAt' => $flip->toIso8601ZuluString()];
        }

        return in_array($code, ['not_checked_in', 'too_early', 'no_office_location'], true)
            ? ['action' => 'absen', 'badge' => false, 'flipsAt' => null]
            : ['action' => 'workspace', 'badge' => false, 'flipsAt' => null];
    }

    /**
     * The approved request behind today's row, when there is one (cuti, izin,
     * sakit, dinas luar; setengah hari tetap boleh check-in).
     *
     * @param  array<string, mixed>|null  $day
     * @return array{status: string, statusLabel: string, portion: string|null, blocksCheckIn: bool}|null
     */
    private static function request(?array $day): ?array
    {
        if ($day === null) {
            return null;
        }

        $status = (string) $day['status'];
        $portion = $day['requestPortion'] ?? null;

        if (! in_array($status, ['leave', 'permit', 'sick', 'business_trip'], true) && $portion === null) {
            return null;
        }

        return [
            'status' => $status,
            'statusLabel' => (string) $day['statusLabel'],
            'portion' => is_string($portion) ? $portion : null,
            'blocksCheckIn' => $status !== 'business_trip' && $portion !== 'half_day',
        ];
    }

    private static function label(string $code, ?string $punctuality): string
    {
        return match ($code) {
            'not_checked_in' => 'Belum check-in',
            'checked_in' => $punctuality === 'late' ? 'Sudah check-in · terlambat' : 'Sudah check-in',
            'checked_out' => 'Selesai',
            'too_early' => 'Check-in belum dibuka',
            'holiday' => 'Libur',
            'non_working_day' => 'Bukan hari kerja',
            'day_has_request' => 'Dari pengajuan',
            'no_office_location' => 'Lokasi kantor belum diatur',
            default => '',
        };
    }

    /**
     * @param  array<string, mixed>  $schedule
     * @param  array<string, mixed>|null  $day
     */
    private static function message(
        string $code,
        array $schedule,
        ?array $day,
        int $lateMinutes,
        ?CarbonImmutable $opensAt,
        ?CarbonImmutable $checkedInAt,
        ?CarbonImmutable $checkedOutAt,
    ): string {
        $threshold = self::instant($schedule['lateThreshold'] ?? null);

        return match ($code) {
            'not_checked_in' => $threshold === null
                ? 'Check-in untuk memulai hari kerja.'
                : 'Check-in sebelum '.OfficeClock::time($threshold).' agar tepat waktu.',
            'checked_in' => $checkedInAt === null
                ? 'Anda sudah check-in.'
                : 'Check-in pukul '.OfficeClock::time($checkedInAt).($lateMinutes > 0
                    ? ' · terlambat '.$lateMinutes.' menit (dihitung dari batas toleransi).'
                    : ' · tepat waktu.'),
            'checked_out' => $checkedOutAt === null
                ? 'Absensi hari ini selesai.'
                : 'Check-out pukul '.OfficeClock::time($checkedOutAt).'. Absensi hari ini selesai.',
            'too_early' => $opensAt === null
                ? 'Check-in belum dibuka.'
                : 'Check-in dibuka pukul '.OfficeClock::time($opensAt).'.',
            'holiday' => 'Hari ini libur'.(is_string($schedule['holidayName'] ?? null) ? ': '.$schedule['holidayName'] : '').'.',
            'non_working_day' => 'Hari ini bukan hari kerja Anda.',
            'day_has_request' => 'Hari ini tercatat '.(is_string($day['statusLabel'] ?? null) ? $day['statusLabel'] : 'dari pengajuan').' dari pengajuan yang disetujui.',
            'no_office_location' => 'Belum ada lokasi kantor aktif untuk check-in. Hubungi HR untuk mengatur lokasi kantor.',
            default => '',
        };
    }

    private static function instant(mixed $value): ?CarbonImmutable
    {
        return is_string($value) && $value !== '' ? CarbonImmutable::parse($value) : null;
    }
}
