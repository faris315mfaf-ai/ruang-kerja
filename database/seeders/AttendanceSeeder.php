<?php

namespace Database\Seeders;

use App\Domain\Attendance\Enums\AttendanceLogType;
use App\Domain\Attendance\Enums\AttendanceMethod;
use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Enums\ConsentType;
use App\Domain\Attendance\Enums\HolidayType;
use App\Domain\Attendance\Enums\LogFlag;
use App\Domain\Attendance\Models\AttendanceConsent;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\AttendanceLog;
use App\Domain\Attendance\Models\Holiday;
use App\Domain\Attendance\Models\OfficeLocation;
use App\Domain\Attendance\Models\Shift;
use App\Domain\Attendance\Models\ShiftAssignment;
use App\Domain\Attendance\Services\GeofenceService;
use App\Domain\Attendance\Services\ScheduleResolver;
use App\Domain\Organization\Demo\DemoCompany;
use App\Domain\Organization\Enums\WorkMode;
use App\Models\Company;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Demo attendance (local/testing): Kantor Pusat + Gudang Cikarang, three
 * shifts (mockup LokasiShift), weekly patterns for the demo organization,
 * national holidays and 30 days of history. Idempotent: masters upsert by
 * name/date, history skips dates that already have a row, today stays empty
 * so the demo accounts can check in. anggota@demo.test (Rizky) has no consent
 * yet, so the UU PDP consent screen can be tried.
 */
class AttendanceSeeder extends Seeder
{
    private const string START = '2026-01-01';

    private const int HISTORY_DAYS = 30;

    /** Employees who see the consent screen on their first check-in. */
    private const array WITHOUT_CONSENT = ['anggota@demo.test'];

    /** Direksi and the system admin are not bound to a shift. */
    private const array UNSCHEDULED = ['direksi@demo.test', 'lestari.anggraini@demo.test', 'admin@demo.test'];

    /** email => shift name (default: Reguler, Monday–Friday). */
    private const array SHIFT_OF = [
        'nadia.putri@demo.test' => 'Gudang Pagi',
        'yoga.pratama@demo.test' => 'Gudang Malam',
    ];

    /** @var array<string, array{0: string, 1: HolidayType}> date => [name, type] */
    private const array HOLIDAYS = [
        '2026-01-01' => ['Tahun Baru 2026 Masehi', HolidayType::National],
        '2026-08-17' => ['Hari Kemerdekaan Republik Indonesia', HolidayType::National],
        '2026-09-25' => ['Maulid Nabi Muhammad SAW', HolidayType::National],
        '2026-12-24' => ['Cuti bersama Hari Raya Natal', HolidayType::CollectiveLeave],
        '2026-12-25' => ['Hari Raya Natal', HolidayType::National],
        '2027-01-01' => ['Tahun Baru 2027 Masehi', HolidayType::National],
    ];

    public function run(ScheduleResolver $schedules, GeofenceService $geofence): void
    {
        $company = DemoCompany::ensure();

        DB::transaction(function () use ($company, $schedules, $geofence): void {
            [$office, $warehouse] = $this->locations($company);
            $shifts = $this->shifts($company, $office, $warehouse);
            $this->holidays($company);

            $employees = User::query()
                ->where('company_id', $company->id)
                ->active()
                ->whereNotIn('email', self::UNSCHEDULED)
                ->orderBy('email')
                ->get();

            foreach ($employees as $employee) {
                $this->assign($employee, $shifts);
                $this->consent($employee);
            }

            $today = ScheduleResolver::officeDate(CarbonImmutable::now());

            foreach ($employees as $employee) {
                for ($offset = self::HISTORY_DAYS; $offset >= 1; $offset--) {
                    $this->history($employee, $today->subDays($offset), $schedules, $geofence, [$office, $warehouse]);
                }
            }
        });
    }

    /**
     * @return array{0: OfficeLocation, 1: OfficeLocation}
     */
    private function locations(Company $company): array
    {
        $office = OfficeLocation::withTrashed()->updateOrCreate(
            ['company_id' => $company->id, 'name' => 'Kantor Pusat'],
            ['address' => 'Jl. Jenderal Sudirman Kav. 52, Jakarta Selatan', 'latitude' => -6.2, 'longitude' => 106.816666, 'radius_m' => 100, 'is_active' => true, 'deleted_at' => null],
        );

        $warehouse = OfficeLocation::withTrashed()->updateOrCreate(
            ['company_id' => $company->id, 'name' => 'Gudang Cikarang'],
            ['address' => 'Kawasan Industri Jababeka, Cikarang', 'latitude' => -6.3135, 'longitude' => 107.1465, 'radius_m' => 150, 'is_active' => true, 'deleted_at' => null],
        );

        return [$office, $warehouse];
    }

    /**
     * @return array<string, Shift>
     */
    private function shifts(Company $company, OfficeLocation $office, OfficeLocation $warehouse): array
    {
        $definitions = [
            'Reguler' => ['08:00', '17:00', 60, false, $office->id],
            'Gudang Pagi' => ['06:00', '14:00', 30, false, $warehouse->id],
            'Gudang Malam' => ['22:00', '06:00', 30, true, $warehouse->id],
        ];

        $shifts = [];

        foreach ($definitions as $name => [$start, $end, $break, $crosses, $location]) {
            $shifts[$name] = Shift::withTrashed()->updateOrCreate(
                ['company_id' => $company->id, 'name' => $name],
                [
                    'start_time' => $start,
                    'end_time' => $end,
                    'break_minutes' => $break,
                    'crosses_midnight' => $crosses,
                    'late_tolerance_min' => 10,
                    'early_leave_tolerance_min' => 0,
                    'check_in_window_before_min' => 120,
                    'office_location_id' => $location,
                    'deleted_at' => null,
                ],
            );
        }

        return $shifts;
    }

    private function holidays(Company $company): void
    {
        foreach (self::HOLIDAYS as $date => [$name, $type]) {
            Holiday::query()->updateOrCreate(['company_id' => $company->id, 'date' => $date], ['name' => $name, 'type' => $type]);
        }
    }

    /**
     * @param  array<string, Shift>  $shifts
     */
    private function assign(User $employee, array $shifts): void
    {
        $shift = $shifts[self::SHIFT_OF[$employee->email] ?? 'Reguler'];
        $warehouse = isset(self::SHIFT_OF[$employee->email]);
        $hybrid = $employee->work_mode === WorkMode::Hybrid;

        $patterns = match (true) {
            $warehouse => [[[1, 2, 3, 4, 5, 6], null]],
            // Hybrid: office Monday–Thursday, WFH on Friday.
            $hybrid => [[[1, 2, 3, 4], null], [[5], WorkMode::Wfh]],
            default => [[[1, 2, 3, 4, 5], null]],
        };

        foreach ($patterns as [$weekdays, $mode]) {
            $exists = ShiftAssignment::query()
                ->where('user_id', $employee->id)
                ->whereNull('override_date')
                ->whereDate('valid_from', self::START)
                ->whereRaw('weekdays = ?::smallint[]', ['{'.implode(',', $weekdays).'}'])
                ->exists();

            if (! $exists) {
                ShiftAssignment::query()->create([
                    'user_id' => $employee->id,
                    'shift_id' => $shift->id,
                    'weekdays' => $weekdays,
                    'valid_from' => self::START,
                    'work_mode_override' => $mode,
                ]);
            }
        }
    }

    private function consent(User $employee): void
    {
        if (in_array($employee->email, self::WITHOUT_CONSENT, true)) {
            return;
        }

        foreach (ConsentType::requiredForCheckIn() as $type) {
            AttendanceConsent::query()->firstOrCreate(
                ['user_id' => $employee->id, 'type' => $type, 'version' => AttendanceConsent::currentVersion(), 'revoked_at' => null],
                ['granted_at' => CarbonImmutable::parse(self::START)],
            );
        }
    }

    /**
     * @param  array{0: OfficeLocation, 1: OfficeLocation}  $locations
     */
    private function history(User $employee, CarbonImmutable $date, ScheduleResolver $schedules, GeofenceService $geofence, array $locations): void
    {
        $exists = AttendanceDay::query()->where('user_id', $employee->id)->whereDate('work_date', $date->toDateString())->exists();

        if ($exists) {
            return;
        }

        $schedule = $schedules->forDate($employee, $date);

        if ($schedule->isHoliday() && $schedule->shift !== null) {
            AttendanceDay::query()->create(['user_id' => $employee->id, 'work_date' => $date->toDateString(), 'status' => AttendanceStatus::Holiday]);

            return;
        }

        if (! $schedule->isWorkday() || $schedule->shift === null || $schedule->scheduledStart === null || $schedule->scheduledEnd === null) {
            return;
        }

        // Deterministic "random" per employee and date.
        $roll = crc32($employee->id.$date->toDateString()) % 100;
        $base = [
            'user_id' => $employee->id,
            'work_date' => $date->toDateString(),
            'shift_id' => $schedule->shift->id,
            'scheduled_start' => $schedule->scheduledStart,
            'scheduled_end' => $schedule->scheduledEnd,
        ];

        if ($roll < 3) {
            AttendanceDay::query()->create([...$base, 'status' => AttendanceStatus::Absent]);

            return;
        }

        $remote = $schedule->allowsRemoteCheckIn();
        $location = $schedule->shift->office_location_id === $locations[1]->id ? $locations[1] : $locations[0];
        $lateBy = $roll >= 85 ? 2 + $roll % 30 : 0;
        $checkIn = $lateBy > 0
            ? $schedule->scheduledStart->addMinutes(10 + $lateBy)
            : $schedule->scheduledStart->subMinutes(5 + $roll % 25);
        $forgotCheckOut = $roll === 50;
        $earlyBy = $roll >= 80 && $roll < 85 ? 20 + $roll % 40 : 0;
        $checkOut = $earlyBy > 0 ? $schedule->scheduledEnd->subMinutes($earlyBy) : $schedule->scheduledEnd->addMinutes($roll % 35);

        $status = match (true) {
            $lateBy > 0 => AttendanceStatus::Late,
            $forgotCheckOut => AttendanceStatus::NeedsCorrection,
            $earlyBy > 0 => AttendanceStatus::EarlyLeave,
            $remote && $schedule->workMode === WorkMode::Wfh => AttendanceStatus::Wfh,
            default => AttendanceStatus::Present,
        };

        $span = intdiv($checkOut->getTimestamp() - $checkIn->getTimestamp(), 60);
        $day = AttendanceDay::query()->create([
            ...$base,
            'status' => $status,
            'check_in_at' => $checkIn,
            'check_out_at' => $forgotCheckOut ? null : $checkOut,
            'late_minutes' => $lateBy,
            'early_leave_minutes' => $earlyBy,
            'work_minutes' => $forgotCheckOut ? 0 : max(0, $span - ($span > 240 ? $schedule->shift->break_minutes : 0)),
        ]);

        $in = $this->log($day, AttendanceLogType::CheckIn, $checkIn, $remote, $location, $roll, $geofence);
        $out = $forgotCheckOut ? null : $this->log($day, AttendanceLogType::CheckOut, $checkOut, $remote, $location, $roll + 7, $geofence);

        $day->forceFill([
            'check_in_log_id' => $in->id,
            'check_out_log_id' => $out?->id,
            'is_suspicious' => $in->is_suspicious || ($out->is_suspicious ?? false),
        ])->save();
    }

    private function log(AttendanceDay $day, AttendanceLogType $type, CarbonImmutable $at, bool $remote, OfficeLocation $location, int $roll, GeofenceService $geofence): AttendanceLog
    {
        // Remote days: somewhere in Jakarta/Bekasi; office days: inside the radius.
        $latitude = $remote ? -6.25 - ($roll % 9) / 100 : $location->latitude + (($roll % 11) - 5) / 111_195 * 10;
        $longitude = $remote ? 106.85 + ($roll % 7) / 100 : $location->longitude + (($roll % 7) - 3) / 111_195 * 10;
        $distance = $geofence->distance($latitude, $longitude, $location->latitude, $location->longitude);
        $flags = $roll % 41 === 0 ? [LogFlag::LowAccuracy] : [];

        return AttendanceLog::query()->create([
            'user_id' => $day->user_id,
            'attendance_day_id' => $day->id,
            'type' => $type,
            'method' => $remote ? AttendanceMethod::Wfh : AttendanceMethod::GpsSelfie,
            'occurred_at' => $at,
            'client_time' => $at,
            'latitude' => round($latitude, 7),
            'longitude' => round($longitude, 7),
            'accuracy_m' => $flags === [] ? 8 + $roll % 20 : 140,
            'office_location_id' => $remote ? null : $location->id,
            'distance_m' => round($distance, 2),
            // No network/device data: the first real check-in is not "perangkat baru".
            'ip_address' => null,
            'user_agent' => 'Data demo',
            'device_fingerprint' => null,
            'flags' => $flags,
            'is_suspicious' => $flags !== [],
            'note' => $remote ? 'Bekerja dari rumah' : null,
        ]);
    }
}
