<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Enums\ConsentType;
use App\Domain\Attendance\Models\AttendanceConsent;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Records consent for location + selfie for the current policy version
 * (idempotent). docs/ARCHITECTURE.md §5.
 */
final class GiveAttendanceConsent
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function handle(User $user): void
    {
        $version = AttendanceConsent::currentVersion();

        DB::transaction(function () use ($user, $version): void {
            $granted = [];

            foreach (ConsentType::requiredForCheckIn() as $type) {
                $exists = AttendanceConsent::query()
                    ->current()
                    ->where('user_id', $user->id)
                    ->where('type', $type->value)
                    ->exists();

                if ($exists) {
                    continue;
                }

                AttendanceConsent::query()->create([
                    'user_id' => $user->id,
                    'type' => $type,
                    'version' => $version,
                    'granted_at' => now(),
                ]);

                $granted[] = $type->value;
            }

            if ($granted !== []) {
                $this->audit->log('attendance.consent_granted', $user, null, ['types' => $granted, 'version' => $version], $user);
            }
        });
    }
}
