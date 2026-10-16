<?php

namespace App\Http\Presenters;

use App\Domain\Auth\Services\PasswordPolicy;
use App\Models\User;

/**
 * The signed-in employee as the mobile app sees them.
 *
 * - concise(): what login returns (unchanged shape since Tahap 1);
 * - profile(): GET /auth/saya — concise() plus everything the app needs to
 *   render menus without guessing from 404s: roles, staff flag, feature
 *   flags and the organisation links. There is deliberately NO leave
 *   balance here (staff never get one — owner decision 6 Oct 2026).
 */
final readonly class ApiUserPresenter
{
    /**
     * Feature flags (config/features.php) the app switches menus on. Hiring has
     * no flag (it is always on for HR/assigned reviewers, gated by Policy).
     *
     * @var list<string>
     */
    public const array FEATURES = ['chat', 'notes', 'meetings', 'okr', 'automation', 'role_dashboards'];

    public function __construct(private PasswordPolicy $passwords) {}

    /**
     * @return array<string, mixed>
     */
    public function concise(User $user): array
    {
        $user->loadMissing(['division', 'position']);

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'jabatan' => $user->position?->name,
            'divisi' => $user->division?->name,
            'work_mode' => [
                'value' => $user->work_mode->value,
                'label' => $user->work_mode->label(),
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function profile(User $user): array
    {
        $user->loadMissing(['division', 'position', 'team', 'manager', 'profile', 'roles']);

        return [
            ...$this->concise($user),
            'roles' => $user->roles->pluck('name')->sort()->values()->all(),
            'is_staff_only' => $user->isStaffOnly(),
            'features' => $this->features(),
            'position' => $user->position === null ? null : ['id' => $user->position->id, 'name' => $user->position->name],
            'division' => $user->division === null ? null : ['id' => $user->division->id, 'name' => $user->division->name],
            'team' => $user->team === null ? null : ['id' => $user->team->id, 'name' => $user->team->name],
            'manager' => $user->manager === null ? null : ['id' => $user->manager->id, 'name' => $user->manager->name],
            'employee_number' => $user->profile?->employee_number,
            'joined_at' => $user->joined_at?->toDateString(),
            'led_division_ids' => $user->ledDivisionIds(),
            'two_factor_enabled' => $user->hasEnabledTwoFactorAuthentication(),
            'password_change_required' => $user->password_change_required,
            'password_hint' => $this->passwords->hint($user),
        ];
    }

    /**
     * @return array<string, bool>
     */
    private function features(): array
    {
        $features = [];

        foreach (self::FEATURES as $feature) {
            $features[$feature] = config()->boolean("features.{$feature}");
        }

        return $features;
    }
}
