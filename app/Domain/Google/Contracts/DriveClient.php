<?php

namespace App\Domain\Google\Contracts;

use App\Domain\Google\Data\DriveItem;
use App\Domain\Google\Data\DrivePermission;
use App\Domain\Google\Data\SharedDrive;
use App\Domain\Google\Data\UploadProgress;
use App\Domain\Google\Enums\DriveRole;
use App\Domain\Google\Exceptions\DriveRequestFailed;

/**
 * The Drive v3 operations RuangKerja uses. Every method talks to Google with
 * one set of credentials (service account or a user's OAuth token) and
 * throws DriveRequestFailed on any non-2xx answer.
 *
 * Implementations: HttpDriveClient (real), FakeDriveClient (tests/local).
 * All calls support Shared Drives (supportsAllDrives=true).
 */
interface DriveClient
{
    /**
     * @throws DriveRequestFailed
     */
    public function getSharedDrive(string $driveId): SharedDrive;

    /**
     * @throws DriveRequestFailed 404 when missing or not visible
     */
    public function getFile(string $fileId): DriveItem;

    /**
     * Non-trashed folder carrying appProperties[$key] = $value inside the Shared Drive.
     *
     * @throws DriveRequestFailed
     */
    public function findFolderByAppProperty(string $key, string $value, string $driveId): ?DriveItem;

    /**
     * Non-trashed direct children of a folder (all pages). Pass the Shared
     * Drive id when known (faster `corpora=drive` query).
     *
     * @return list<DriveItem>
     *
     * @throws DriveRequestFailed
     */
    public function listChildren(string $folderId, ?string $driveId = null): array;

    /**
     * @param  array<string, string>  $appProperties
     *
     * @throws DriveRequestFailed
     */
    public function createFolder(string $name, string $parentId, array $appProperties = []): DriveItem;

    /**
     * Creates an empty file, e.g. a Google Doc (mimeType application/vnd.google-apps.document).
     *
     * @throws DriveRequestFailed
     */
    public function createFile(string $name, string $mimeType, string $parentId): DriveItem;

    /**
     * @throws DriveRequestFailed
     */
    public function rename(string $fileId, string $name): DriveItem;

    /**
     * Permanently deletes a file/folder (used by ruangkerja:google-check --write only).
     *
     * @throws DriveRequestFailed
     */
    public function deleteFile(string $fileId): void;

    /**
     * @return list<DrivePermission>
     *
     * @throws DriveRequestFailed
     */
    public function listPermissions(string $fileId): array;

    /**
     * @throws DriveRequestFailed
     */
    public function createPermission(string $fileId, string $email, DriveRole $role, bool $notify = false): DrivePermission;

    /**
     * @throws DriveRequestFailed
     */
    public function updatePermission(string $fileId, string $permissionId, DriveRole $role): DrivePermission;

    /**
     * @throws DriveRequestFailed
     */
    public function deletePermission(string $fileId, string $permissionId): void;

    /**
     * Opens a resumable upload session and returns its session URI.
     *
     * @throws DriveRequestFailed
     */
    public function startResumableUpload(string $name, string $mimeType, int $size, string $parentId): string;

    /**
     * Sends bytes [$offset, $offset + strlen($bytes)) of a $total-byte upload.
     *
     * @throws DriveRequestFailed 404/410 when the session expired
     */
    public function uploadChunk(string $sessionUri, string $bytes, int $offset, int $total): UploadProgress;

    /**
     * Asks how many bytes the session already received.
     *
     * @throws DriveRequestFailed 404/410 when the session expired
     */
    public function uploadStatus(string $sessionUri, int $total): UploadProgress;
}
