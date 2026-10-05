<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Models\AttendanceLog;
use App\Domain\Attendance\Services\SelfieStorage;
use App\Domain\Organization\Services\AuditLogger;
use Carbon\CarbonInterface;

/**
 * Selfie retention (docs/ARCHITECTURE.md §5): deletes selfie files of logs
 * older than ATTENDANCE_SELFIE_RETENTION_MONTHS and clears their path. The
 * attendance log itself stays. Idempotent.
 */
final class PurgeExpiredSelfies
{
    public function __construct(
        private readonly SelfieStorage $selfies,
        private readonly AuditLogger $audit,
    ) {}

    /**
     * Returns the number of selfies deleted.
     */
    public function handle(CarbonInterface $now): int
    {
        $months = max(1, config()->integer('attendance.selfie.retention_months'));
        $cutoff = $now->copy()->subMonthsNoOverflow($months);
        $deleted = 0;

        AttendanceLog::query()
            ->whereNotNull('selfie_path')
            ->where('occurred_at', '<', $cutoff)
            ->chunkById(500, function ($logs) use (&$deleted): void {
                foreach ($logs as $log) {
                    $this->selfies->delete((string) $log->selfie_path);
                    $log->selfie_path = null;
                    $log->save();
                    $deleted++;
                }
            });

        if ($deleted > 0) {
            $this->audit->log('selfie.purged', null, null, [
                'count' => $deleted,
                'older_than' => $cutoff->toIso8601String(),
                'retention_months' => $months,
            ]);
        }

        return $deleted;
    }
}
