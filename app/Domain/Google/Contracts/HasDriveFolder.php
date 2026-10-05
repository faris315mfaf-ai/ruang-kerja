<?php

namespace App\Domain\Google\Contracts;

use App\Domain\Google\Data\DriveMember;

/**
 * Something that owns a folder in the Shared Drive (a Workspace; later maybe
 * a task sub-folder). Implemented by Eloquent models so queued jobs can
 * serialize it — use the InteractsWithDriveFolder trait for the defaults.
 */
interface HasDriveFolder
{
    /**
     * Stable identity written to the folder's appProperties ("workspace:01J...")
     * so an orphaned folder can be found again instead of duplicated.
     */
    public function driveFolderKey(): string;

    /**
     * Folder title, e.g. "Proyek Peluncuran Q4 [PLQ]".
     */
    public function driveFolderName(): string;

    /**
     * Google id of the parent folder; null = root of the Shared Drive.
     */
    public function driveParentFolderId(): ?string;

    /**
     * Stored folder id (e.g. workspaces.drive_folder_id), null when none yet.
     */
    public function driveFolderId(): ?string;

    /**
     * Persist the folder id (null clears it).
     */
    public function storeDriveFolderId(?string $folderId): void;

    /**
     * Desired direct permissions on the folder. Everyone else with a direct
     * user permission (except protected e-mails) is revoked by the sync.
     *
     * @return list<DriveMember>
     */
    public function driveMembers(): array;

    /**
     * Workspace that owns files cached in drive_files for this folder.
     */
    public function driveWorkspaceId(): string;
}
