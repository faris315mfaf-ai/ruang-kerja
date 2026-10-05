<?php

namespace App\Domain\Google\Events;

use App\Domain\Google\Contracts\HasDriveFolder;
use App\Domain\Google\Data\DriveMember;
use App\Domain\Google\Data\PermissionSyncResult;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * A folder's permissions now match `$members` (CreateDriveFolder or
 * SyncDrivePermissions finished). `$result->skipped` lists e-mails Google
 * rejected. The Workspaces module records the "Akses Drive" status per member.
 */
final class DrivePermissionsSynced
{
    use Dispatchable;

    /**
     * @param  list<DriveMember>  $members  desired access at sync time
     */
    public function __construct(
        public Model&HasDriveFolder $owner,
        public string $folderId,
        public array $members,
        public PermissionSyncResult $result,
    ) {}
}
