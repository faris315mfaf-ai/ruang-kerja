<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Data\AttendanceWindows;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\Company;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Saves the company-wide "jam absen" (Admin › Lokasi, shift & hari libur):
 * the time-of-day range of check-in and check-out, in
 * `companies.settings.attendance_windows`. All four bounds are optional; all
 * empty removes the key (no limit). Audit: `attendance.windows_updated`.
 */
final class SaveAttendanceWindows
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function handle(User $actor, AttendanceWindows $windows): AttendanceWindows
    {
        return DB::transaction(function () use ($actor, $windows): AttendanceWindows {
            $company = Company::query()->whereKey($actor->company_id)->lockForUpdate()->firstOrFail();
            $old = AttendanceWindows::fromSettings($company->settings);
            $settings = $company->settings;
            $stored = $windows->toSettings();

            if ($stored === null) {
                unset($settings[AttendanceWindows::KEY]);
            } else {
                $settings[AttendanceWindows::KEY] = $stored;
            }

            // The audit row below is the trail; no generic `company.updated` rewrite of the whole settings blob.
            $company->settings = $settings;
            $company->saveQuietly();

            if ($old != $windows) {
                $this->audit->log('attendance.windows_updated', $company, $old->toSettings(), $windows->toSettings(), $actor);
            }

            return $windows;
        });
    }
}
