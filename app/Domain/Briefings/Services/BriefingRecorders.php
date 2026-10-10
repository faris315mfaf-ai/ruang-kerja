<?php

namespace App\Domain\Briefings\Services;

use App\Domain\Briefings\Enums\BriefingPeriod;
use App\Domain\Organization\Enums\Role;
use App\Models\BriefingDelegation;
use App\Models\User;

/**
 * Who may take the briefing notes (keputusan pemilik 9 Okt 2026):
 * HR & Super Admin by role, plus one appointed delegate per company, office
 * date and period. The delegate may record as if they were the recorder —
 * only for that date + period.
 */
final class BriefingRecorders
{
    public static function isRecorder(User $user): bool
    {
        return $user->isActive() && $user->hasAnyRole([Role::Hr, Role::SuperAdmin]);
    }

    /**
     * The active delegation of a company for one date + period, if any.
     */
    public function delegationFor(string $companyId, string $briefingDate, BriefingPeriod $period): ?BriefingDelegation
    {
        return BriefingDelegation::query()
            ->where('company_id', $companyId)
            ->whereDate('briefing_date', $briefingDate)
            ->where('period', $period->value)
            ->first();
    }

    /**
     * Whether $user may save the notes of this date + period (window checked
     * separately by SaveBriefing).
     */
    public function canRecord(User $user, string $briefingDate, BriefingPeriod $period): bool
    {
        if (! $user->isActive()) {
            return false;
        }

        if (self::isRecorder($user)) {
            return true;
        }

        return $this->delegationFor((string) $user->company_id, $briefingDate, $period)?->delegated_to === $user->id;
    }

    /**
     * Whether $user is the appointed delegate of any period today (policy
     * gate; the exact date + period is re-checked by SaveBriefing).
     */
    public function isDelegateToday(User $user, string $briefingDate): bool
    {
        if (self::isRecorder($user)) {
            return false;
        }

        return BriefingDelegation::query()
            ->where('delegated_to', $user->id)
            ->whereDate('briefing_date', $briefingDate)
            ->exists();
    }
}
