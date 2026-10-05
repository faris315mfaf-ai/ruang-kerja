<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Models\AttendanceLog;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * HR marks a flagged check-in/out as reviewed ("Tandai sudah ditinjau").
 * Idempotent: the first reviewer and time are kept.
 */
final class MarkLogReviewed
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function handle(User $reviewer, AttendanceLog $log): AttendanceLog
    {
        if ($log->reviewed_at !== null) {
            return $log;
        }

        $log->reviewed_by = $reviewer->id;
        $log->reviewed_at = CarbonImmutable::now();
        $log->save();

        $this->audit->log('attendance.log_reviewed', $log, null, [
            'employee_id' => $log->user_id,
            'flags' => $log->flags->map(fn ($flag) => $flag->value)->values()->all(),
        ], $reviewer);

        return $log;
    }
}
