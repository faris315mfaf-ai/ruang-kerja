<?php

namespace App\Domain\Privacy\Services;

use App\Domain\Attendance\Enums\ConsentType;
use App\Domain\Attendance\Models\AttendanceConsent;
use App\Models\User;

/**
 * Current location + selfie consent of ONE person, for the mobile app
 * (GET/POST/DELETE /api/v1/persetujuan). Always queried by the user's own id.
 * The overall flags come from MyData::consent() (same numbers as the web
 * page); `types` adds the per-type state the consent screen needs.
 */
final class ConsentOverview
{
    public function __construct(private readonly MyData $data) {}

    /**
     * @return array<string, mixed>
     */
    public function for(User $user): array
    {
        $overall = $this->data->consent($user);
        $current = AttendanceConsent::currentVersion();

        $types = [];

        foreach (ConsentType::requiredForCheckIn() as $type) {
            $active = AttendanceConsent::query()
                ->where('user_id', $user->id)
                ->where('type', $type->value)
                ->whereNull('revoked_at')
                ->latest('granted_at')
                ->first();

            $types[$type->value] = [
                'label' => $type->label(),
                'granted' => $active !== null && $active->version === $current,
                'granted_version' => $active?->version,
                'granted_at' => $active?->granted_at->toIso8601String(),
            ];
        }

        return [
            'granted' => $overall['granted'],
            'version' => $overall['version'],
            'policy_version' => $overall['policy_version'],
            'granted_version' => $overall['granted_version'],
            'granted_at' => $overall['granted_at'],
            'needs_renewal' => $overall['needs_renewal'],
            'retention_months' => $overall['retention_months'],
            'types' => $types,
            'history' => $overall['history'],
        ];
    }
}
