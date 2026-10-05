<?php

namespace App\Domain\Requests\Actions;

use App\Domain\Organization\Enums\UserStatus;
use App\Models\Company;
use App\Models\LeaveBalance;
use App\Models\LeaveType;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Creates the yearly balances (leave types with an annual quota) for every
 * active employee, with carry-over from last year's unused days capped by
 * `carry_over_max_days`. Idempotent: existing balances are left untouched.
 */
final class GenerateAnnualBalances
{
    /**
     * @return array{created: int, skipped: int}
     */
    public function handle(int $year, ?Company $company = null): array
    {
        $created = 0;
        $skipped = 0;

        $types = LeaveType::query()
            ->active()
            ->whereNotNull('annual_quota_days')
            ->when($company !== null, fn ($query) => $query->where('company_id', $company?->id))
            ->get();

        foreach ($types as $type) {
            User::query()
                ->where('company_id', $type->company_id)
                ->where('status', UserStatus::Active->value)
                ->orderBy('id')
                ->chunkById(200, function ($users) use ($type, $year, &$created, &$skipped): void {
                    foreach ($users as $user) {
                        /** @var User $user */
                        if (! $type->isEligible($user, now()->setDate($year, 1, 1))) {
                            $skipped++;

                            continue;
                        }

                        $wasCreated = DB::transaction(fn (): bool => $this->createFor($user, $type, $year));
                        $wasCreated ? $created++ : $skipped++;
                    }
                });
        }

        return ['created' => $created, 'skipped' => $skipped];
    }

    private function createFor(User $user, LeaveType $type, int $year): bool
    {
        $exists = LeaveBalance::query()
            ->where(['user_id' => $user->id, 'leave_type_id' => $type->id, 'year' => $year])
            ->exists();

        if ($exists) {
            return false;
        }

        $previous = LeaveBalance::query()
            ->where(['user_id' => $user->id, 'leave_type_id' => $type->id, 'year' => $year - 1])
            ->first();

        $carry = 0.0;

        if ($previous !== null && $type->carry_over_max_days !== null) {
            $carry = max(0.0, min($previous->available(), $type->carry_over_max_days));
        }

        LeaveBalance::query()->create([
            'user_id' => $user->id,
            'leave_type_id' => $type->id,
            'year' => $year,
            'entitled_days' => $type->annual_quota_days ?? 0,
            'carried_over_days' => $carry,
        ]);

        return true;
    }
}
