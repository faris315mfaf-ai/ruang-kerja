<?php

namespace App\Domain\Google\Jobs;

use App\Domain\Google\Contracts\HasDriveFolder;
use App\Domain\Google\Jobs\Concerns\HandlesGoogleFailures;
use App\Domain\Google\Services\DriveFolderService;
use App\Domain\Google\Services\DrivePermissionSync;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Creates the owner's folder in the Shared Drive (idempotent) and, when it
 * is new or recovered, grants the members access right away.
 *
 * Dispatch after a (non-personal) workspace is created:
 * `CreateDriveFolder::dispatch($workspace)`. Also renames the folder when
 * dispatched again after the owner's name changed.
 */
final class CreateDriveFolder implements ShouldBeUnique, ShouldQueue
{
    use HandlesGoogleFailures, Queueable;

    public bool $deleteWhenMissingModels = true;

    public int $uniqueFor = 600;

    public function __construct(public Model&HasDriveFolder $owner) {}

    public function uniqueId(): string
    {
        return $this->owner->driveFolderKey();
    }

    public function handle(DriveFolderService $folders, DrivePermissionSync $permissions): void
    {
        $this->runGoogle(function () use ($folders, $permissions): void {
            $folder = $folders->ensure($this->owner);

            if ($folder->needsPermissionSync()) {
                $permissions->sync($folder->folderId, $this->owner->driveMembers());
            }
        });
    }

    protected function subject(): string
    {
        return $this->owner->driveFolderKey();
    }
}
