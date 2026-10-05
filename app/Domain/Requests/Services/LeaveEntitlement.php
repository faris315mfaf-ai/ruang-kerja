<?php

namespace App\Domain\Requests\Services;

use App\Models\LeaveType;
use App\Models\User;

/**
 * Yearly entitlement of a leave type with a quota, prorated for employees who
 * join during the year (Fitur pengajuan #3a).
 *
 * Rule (docs/sprints/FITUR-PENGAJUAN.md):
 *   remaining months = months from the join month to December, the join month
 *                      counting only when joined on day 1–15;
 *   entitlement      = annual_quota × remaining months / 12, rounded DOWN to 0.5 day.
 *
 * Joined before the year (or join date unknown) → full quota; joined after the
 * year → 0. Example: quota 12, joined 1 Jul → 6 months → 6 days; joined 20 Jul
 * → 5 months → 5 days; quota 12, joined 10 Mar → 10 months → 10 days.
 */
final class LeaveEntitlement
{
    public function forYear(User $user, LeaveType $type, int $year): float
    {
        $quota = (float) ($type->annual_quota_days ?? 0);
        $joined = $user->joined_at;

        if ($joined === null || $joined->year < $year) {
            return $quota;
        }

        if ($joined->year > $year) {
            return 0.0;
        }

        return self::prorate($quota, self::remainingMonths($joined->month, $joined->day));
    }

    /**
     * Months of the join year still worked: Jan 1–15 → 12, Jan 16–31 → 11, …, Dec 16–31 → 0.
     */
    public static function remainingMonths(int $month, int $day): int
    {
        return 12 - $month + ($day <= 15 ? 1 : 0);
    }

    public static function prorate(float $quota, int $months): float
    {
        $months = max(0, min(12, $months));

        return floor($quota * $months / 12 * 2) / 2;
    }
}
