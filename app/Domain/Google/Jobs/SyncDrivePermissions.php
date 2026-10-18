<?php

namespace App\Domain\Google\Jobs;

use App\Domain\Google\Contracts\HasDriveFolder;
use App\Domain\Google\Events\DrivePermissionsSynced;
use App\Domain\Google\Events\DrivePermissionsSyncFailed;
use App\Domain\Google\Exceptions\GoogleException;
use App\Domain\Google\Jobs\Concerns\HandlesGoogleFailures;
use App\Domain\Google\Services\DriveFolderService;
use App\Domain\Google\Services\DrivePermissionSync;
use App\Domain\Tenancy\Concerns\CompanyAware;
use Illuminate\Contracts\Queue\ShouldBeUniqueUntilProcessing;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Throwable;

/**
 * Makes the folder's permissions match `$owner->driveMembers()` at the time
 * the job runs (so bursts of member changes collapse into one sync).
 * Verifies the folder first and recreates it when it was deleted (404).
 *
 * Dispatch whenever members/roles change: `SyncDrivePermissions::dispatch($workspace)`.
 */
final class SyncDrivePermissions implements ShouldBeUniqueUntilProcessing, ShouldQueue
{
    use CompanyAware;
    use HandlesGoogleFailures, Queueable;

    public bool $deleteWhenMissingModels = true;

    public int $uniqueFor = 600;

    public function __construct(public Model&HasDriveFolder $owner) {}

    public function uniqueId(): string
    {
        return $this->owner->driveFolderKey();
    }

    /**
     * @return list<object>
     */
    public function middleware(): array
    {
        return [...$this->companyMiddleware(), (new WithoutOverlapping('google-permissions:'.$this->owner->driveFolderKey()))->releaseAfter(30)->expireAfter(300)];
    }

    public function handle(DriveFolderService $folders, DrivePermissionSync $permissions): void
    {
        $this->runGoogle(function () use ($folders, $permissions): void {
            $folder = $folders->ensure($this->owner);

            $members = $this->owner->driveMembers();
            $result = $permissions->sync($folder->folderId, $members);

            DrivePermissionsSynced::dispatch($this->owner, $folder->folderId, $members, $result);
        });
    }

    public function failed(?Throwable $exception): void
    {
        DrivePermissionsSyncFailed::dispatch(
            $this->owner,
            $exception instanceof GoogleException ? $exception->errorCode() : 'sync_failed',
        );
    }

    protected function subject(): string
    {
        return $this->owner->driveFolderKey();
    }
}
