<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Models\AttendanceConsent;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Withdraws location + selfie consent ("Cabut persetujuan"). Check-in is
 * refused until the employee consents again.
 */
final class RevokeAttendanceConsent
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function handle(User $user): void
    {
        DB::transaction(function () use ($user): void {
            $revoked = AttendanceConsent::query()
                ->where('user_id', $user->id)
                ->whereNull('revoked_at')
                ->update(['revoked_at' => now(), 'updated_at' => now()]);

            if ($revoked > 0) {
                $this->audit->log('attendance.consent_revoked', $user, null, ['count' => $revoked], $user);
            }
        });
    }
}
