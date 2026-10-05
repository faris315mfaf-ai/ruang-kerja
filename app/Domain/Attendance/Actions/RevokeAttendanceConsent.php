<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Models\AttendanceConsent;
use App\Domain\Attendance\Notifications\ConsentRevokedNotification;
use App\Domain\Organization\Enums\Role;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

/**
 * Withdraws location + selfie consent ("Cabut persetujuan", from the Absensi
 * page or Privasi › Data Saya). GPS + selfie check-in is refused until the
 * employee consents again; HR of the company is notified (UU PDP) so it can
 * arrange another way to record attendance. Idempotent: nothing to revoke →
 * no audit entry, no notification.
 */
final class RevokeAttendanceConsent
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function handle(User $user): int
    {
        $revoked = DB::transaction(function () use ($user): int {
            $revoked = AttendanceConsent::query()
                ->where('user_id', $user->id)
                ->whereNull('revoked_at')
                ->update(['revoked_at' => now(), 'updated_at' => now()]);

            if ($revoked > 0) {
                $this->audit->log('attendance.consent_revoked', $user, null, ['count' => $revoked], $user);
            }

            return $revoked;
        });

        if ($revoked > 0) {
            $hr = User::role(Role::Hr->value)
                ->active()
                ->where('company_id', $user->company_id)
                ->whereKeyNot($user->id)
                ->get();

            Notification::send($hr, new ConsentRevokedNotification($user));
        }

        return $revoked;
    }
}
