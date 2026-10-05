<?php

namespace App\Domain\Google\Jobs;

use App\Domain\Google\Jobs\Concerns\HandlesGoogleFailures;
use App\Domain\Google\Services\DriveFolderContentsSync;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Refreshes the drive_files cache of one folder level. Dispatch when the
 * File tab opens and DriveFolderContentsSync::isStale($folderId).
 */
final class SyncDriveFolderContents implements ShouldBeUnique, ShouldQueue
{
    use HandlesGoogleFailures, Queueable;

    public int $uniqueFor = 300;

    public function __construct(
        public string $workspaceId,
        public string $folderId,
    ) {}

    public function uniqueId(): string
    {
        return $this->folderId;
    }

    public function handle(DriveFolderContentsSync $sync): void
    {
        $this->runGoogle(fn (): int => $sync->sync($this->workspaceId, $this->folderId));
    }

    protected function subject(): string
    {
        return 'folder:'.$this->folderId;
    }
}
