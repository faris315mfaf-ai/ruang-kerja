<?php

namespace App\Domain\Google\Services;

use App\Domain\Google\Contracts\DriveClient;
use App\Domain\Google\Data\DriveMember;
use App\Domain\Google\Data\DrivePermission;
use App\Domain\Google\Data\PermissionSyncResult;
use App\Domain\Google\Enums\DriveRole;
use App\Domain\Google\Exceptions\DriveRequestFailed;
use App\Domain\Google\Exceptions\GoogleNotConfigured;
use Illuminate\Support\Facades\Log;

/**
 * Makes a folder's direct user permissions match the desired members:
 * adds missing people, changes roles that differ, revokes everyone else.
 *
 * Never touched: inherited access (Shared Drive membership), non-user
 * permissions (domain, group, anyone), the impersonated admin and
 * google.permissions.protected_emails. Running it twice is a no-op.
 * Per-person errors that will not go away by retrying (e.g. an address
 * Google rejects) are skipped and reported; rate limits and 5xx bubble up
 * so the job retries with backoff.
 */
final class DrivePermissionSync
{
    public function __construct(private readonly GoogleClientFactory $google) {}

    /**
     * @param  list<DriveMember>  $members
     *
     * @throws DriveRequestFailed|GoogleNotConfigured
     */
    public function sync(string $folderId, array $members, ?int $timeout = null): PermissionSyncResult
    {
        $drive = $this->google->serviceAccount($timeout);
        $result = new PermissionSyncResult;
        $desired = $this->desired($members, $result);
        $protected = $this->protectedEmails();

        /** @var array<string, DrivePermission> $direct */
        $direct = [];
        /** @var array<string, DriveRole> $inherited */
        $inherited = [];

        foreach ($drive->listPermissions($folderId) as $permission) {
            $email = $permission->email();
            $role = $permission->driveRole();

            if ($permission->type !== 'user' || $email === null || $role === null) {
                continue;
            }

            if ($permission->inherited) {
                $inherited[$email] = isset($inherited[$email]) && $inherited[$email]->covers($role) ? $inherited[$email] : $role;
            } elseif ($permission->isManagedUser()) {
                $direct[$email] = $permission;
            }
        }

        foreach ($desired as $email => $role) {
            if (isset($direct[$email])) {
                $this->updateIfNeeded($drive, $folderId, $direct[$email], $role, $result);

                continue;
            }

            if (isset($inherited[$email]) && $inherited[$email]->covers($role)) {
                continue; // Shared Drive membership already grants this.
            }

            $this->attempt($result, $email, function () use ($drive, $folderId, $email, $role, $result): void {
                $drive->createPermission($folderId, $email, $role, (bool) config('google.permissions.notify', false));
                $result->added[] = $email;
            });
        }

        foreach ($direct as $email => $permission) {
            if (isset($desired[$email]) || in_array($email, $protected, true)) {
                continue;
            }

            $this->attempt($result, $email, function () use ($drive, $folderId, $email, $permission, $result): void {
                try {
                    $drive->deletePermission($folderId, $permission->id);
                } catch (DriveRequestFailed $exception) {
                    if (! $exception->isNotFound()) {
                        throw $exception;
                    }
                }

                $result->removed[] = $email;
            });
        }

        Log::info('google.permissions.synced', ['folder_id' => $folderId] + $result->counts());

        return $result;
    }

    private function updateIfNeeded(DriveClient $drive, string $folderId, DrivePermission $permission, DriveRole $role, PermissionSyncResult $result): void
    {
        $email = (string) $permission->email();

        if ($permission->role === $role->value) {
            return;
        }

        if (! in_array($permission->role, ['writer', 'commenter', 'reader'], true)) {
            // organizer/fileOrganizer/owner were granted by a Drive admin on purpose.
            $result->skipped[$email] = 'elevated_role';

            return;
        }

        $this->attempt($result, $email, function () use ($drive, $folderId, $permission, $role, $result, $email): void {
            $drive->updatePermission($folderId, $permission->id, $role);
            $result->updated[] = $email;
        });
    }

    /**
     * Runs one per-person change; permanent errors are skipped, retryable ones rethrown.
     *
     * @param  callable(): void  $change
     *
     * @throws DriveRequestFailed
     */
    private function attempt(PermissionSyncResult $result, string $email, callable $change): void
    {
        try {
            $change();
        } catch (DriveRequestFailed $exception) {
            if ($exception->isRetryable()) {
                throw $exception;
            }

            $result->skipped[$email] = $exception->reason ?? 'status_'.$exception->status;
            Log::warning('google.permissions.skipped', $exception->context() + ['email_hash' => sha1($email)]);
        }
    }

    /**
     * Highest role per valid, unique e-mail.
     *
     * @param  list<DriveMember>  $members
     * @return array<string, DriveRole>
     */
    private function desired(array $members, PermissionSyncResult $result): array
    {
        $desired = [];

        foreach ($members as $member) {
            if (filter_var($member->email, FILTER_VALIDATE_EMAIL) === false) {
                $result->skipped[$member->email] = 'invalid_email';

                continue;
            }

            $current = $desired[$member->email] ?? null;
            $desired[$member->email] = $current !== null && $current->covers($member->role) ? $current : $member->role;
        }

        return $desired;
    }

    /**
     * @return list<string>
     */
    private function protectedEmails(): array
    {
        /** @var list<string> $configured */
        $configured = config('google.permissions.protected_emails', []);
        $impersonated = strtolower((string) config('google.service_account.impersonate', ''));

        return array_values(array_filter([...$configured, $impersonated]));
    }
}
