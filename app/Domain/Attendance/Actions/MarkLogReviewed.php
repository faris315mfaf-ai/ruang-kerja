<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Models\AttendanceLog;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * HR marks a flagged check-in/out as reviewed ("Tandai sudah ditinjau").
 * Idempotent: the first reviewer and time are kept, also when two HR click at
 * the same moment (conditional update on reviewed_at IS NULL; only the one
 * that changed the row writes the audit entry).
 */
final class MarkLogReviewed
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function handle(User $reviewer, AttendanceLog $log): AttendanceLog
    {
        if ($log->reviewed_at !== null) {
            return $log;
        }

        $now = CarbonImmutable::now();
        $updated = AttendanceLog::query()
            ->whereKey($log->id)
            ->whereNull('reviewed_at')
            ->update(['reviewed_by' => $reviewer->id, 'reviewed_at' => $now]);

        if ($updated === 0) {
            // Someone else reviewed it first: show their review.
            return $log->refresh();
        }

        $log->forceFill(['reviewed_by' => $reviewer->id, 'reviewed_at' => $now])->syncOriginal();

        $this->audit->log('attendance.log_reviewed', $log, null, [
            'employee_id' => $log->user_id,
            'flags' => $log->flags->map(fn ($flag) => $flag->value)->values()->all(),
        ], $reviewer);

        return $log;
    }
}
