<?php

namespace App\Domain\Google\Events;

use App\Domain\Google\Contracts\HasDriveFolder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * CreateDriveFolder / SyncDrivePermissions gave up (retries exhausted or a
 * permanent Google error). Members still waiting for access show an error.
 */
final class DrivePermissionsSyncFailed
{
    use Dispatchable;

    public function __construct(
        public Model&HasDriveFolder $owner,
        public string $reason,
    ) {}
}
