<?php

namespace App\Domain\Organization\Actions;

use App\Domain\Google\Actions\SyncUserDriveAccess;
use App\Domain\Organization\Enums\UserStatus;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Lets an inactive/resigned employee sign in again. Writes `user.reactivated`
 * and re-syncs the Drive folders of their workspaces (access restored after commit).
 */
final readonly class ReactivateEmployee
{
    public function __construct(
        private AuditLogger $audit,
        private SyncUserDriveAccess $driveAccess,
    ) {}

    public function handle(User $actor, User $employee, ?string $reason = null): void
    {
        if ($employee->status === UserStatus::Active) {
            return;
        }

        DB::transaction(function () use ($actor, $employee, $reason): void {
            $before = $employee->status;

            $employee->status = UserStatus::Active;
            $employee->saveQuietly();

            $this->audit->log(
                'user.reactivated',
                $employee,
                ['status' => $before->value],
                array_filter(['status' => UserStatus::Active->value, 'reason' => $reason], fn (?string $value): bool => $value !== null),
                $actor,
            );

            $this->driveAccess->handle($employee);
        });
    }
}
