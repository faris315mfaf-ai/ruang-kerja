<?php

namespace App\Domain\Organization\Actions;

use App\Domain\Organization\Enums\UserStatus;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * Sets an employee to `inactive` or `resigned` (never hard-deletes). The person is
 * signed out on their next request by EnsureActiveEmployee; their attendance and
 * task history stays. Writes one `user.deactivated` audit row with the reason.
 *
 * Optionally moves their direct reports to the deactivated person's own manager so
 * approvals keep routing to an active person (each move is audited as `user.updated`).
 */
final readonly class DeactivateEmployee
{
    public function __construct(private AuditLogger $audit) {}

    /**
     * @return int number of direct reports moved
     */
    public function handle(User $actor, User $employee, UserStatus $status, string $reason, bool $reassignReports = false): int
    {
        if ($status === UserStatus::Active) {
            throw new InvalidArgumentException('Use ReactivateEmployee to activate an employee.');
        }

        return DB::transaction(function () use ($actor, $employee, $status, $reason, $reassignReports): int {
            $before = $employee->status;

            // One explicit audit row (with the reason) instead of a generic user.updated.
            $employee->status = $status;
            $employee->saveQuietly();

            $this->audit->log(
                'user.deactivated',
                $employee,
                ['status' => $before->value],
                ['status' => $status->value, 'reason' => $reason],
                $actor,
            );

            if (! $reassignReports) {
                return 0;
            }

            $moved = 0;

            foreach ($employee->directReports()->get() as $report) {
                $report->manager_id = $employee->manager_id;
                $report->save();
                $moved++;
            }

            return $moved;
        });
    }
}
