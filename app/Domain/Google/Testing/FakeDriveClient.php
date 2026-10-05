<?php

namespace App\Domain\Google\Testing;

use App\Domain\Google\Contracts\DriveClient;
use App\Domain\Google\Data\DriveItem;
use App\Domain\Google\Data\DrivePermission;
use App\Domain\Google\Data\SharedDrive;
use App\Domain\Google\Data\UploadProgress;
use App\Domain\Google\Enums\DriveFileKind;
use App\Domain\Google\Enums\DriveRole;
use App\Domain\Google\Exceptions\DriveRequestFailed;
use Closure;
use Illuminate\Contracts\Cache\Repository as Cache;
use PHPUnit\Framework\Assert;

/**
 * In-memory Drive used by the test suite (GOOGLE_FAKE=true in phpunit.xml)
 * and, optionally, in local development without Google credentials (state
 * then persists in the cache). Behaves like Drive for the operations in
 * DriveClient, records every call and can inject failures.
 *
 * In tests: `$drive = FakeDriveClient::fake();` then run code and assert,
 * e.g. `$drive->assertFolderCreated('Proyek X [PRX]')`.
 */
final class FakeDriveClient implements DriveClient
{
    public const string SHARED_DRIVE_ID = 'fake-shared-drive';

    private const string CACHE_KEY = 'google:fake-drive';

    private FakeDriveState $state;

    public function __construct(
        string $sharedDriveId = self::SHARED_DRIVE_ID,
        private readonly ?Cache $persist = null,
        private readonly string $actor = 'service-account',
        ?FakeDriveState $state = null,
    ) {
        $this->state = $state ?? new FakeDriveState;

        if ($state === null) {
            $this->state->sharedDrives[$sharedDriveId] = 'RuangKerja';

            $stored = $this->persist?->get(self::CACHE_KEY);

            if (is_array($stored)) {
                $this->state->import($stored);
            }
        }
    }

    /**
     * Turns on fake mode for the current test and binds a fresh fake.
     */
    public static function fake(): self
    {
        config(['google.fake' => true]);

        $sharedDriveId = config('google.shared_drive_id');
        $fake = new self(is_string($sharedDriveId) && $sharedDriveId !== '' ? $sharedDriveId : self::SHARED_DRIVE_ID);

        app()->instance(self::class, $fake);

        return $fake;
    }

    /**
     * Same fake Drive seen through other credentials (e.g. a user's OAuth token).
     */
    public function withActor(string $actor): self
    {
        return new self(persist: $this->persist, actor: $actor, state: $this->state);
    }

    public function actor(): string
    {
        return $this->actor;
    }

    // ---------------------------------------------------------------------
    // DriveClient
    // ---------------------------------------------------------------------

    public function getSharedDrive(string $driveId): SharedDrive
    {
        $this->record('drives.get', ['driveId' => $driveId]);

        if (! isset($this->state->sharedDrives[$driveId])) {
            throw $this->notFound('drives.get');
        }

        return new SharedDrive($driveId, $this->state->sharedDrives[$driveId]);
    }

    public function getFile(string $fileId): DriveItem
    {
        $this->record('files.get', ['fileId' => $fileId]);

        return DriveItem::fromApi($this->fileOrFail($fileId, 'files.get'));
    }

    public function findFolderByAppProperty(string $key, string $value, string $driveId): ?DriveItem
    {
        $this->record('files.list', ['appProperty' => $key, 'value' => $value, 'driveId' => $driveId]);

        foreach ($this->state->files as $file) {
            $item = DriveItem::fromApi($file);

            if ($item->isFolder() && ! $item->trashed && $item->driveId === $driveId
                && ($item->appProperties[$key] ?? null) === $value) {
                return $item;
            }
        }

        return null;
    }

    public function listChildren(string $folderId, ?string $driveId = null): array
    {
        $this->record('files.list', ['folderId' => $folderId, 'driveId' => $driveId]);

        $children = array_values(array_filter(
            array_map(fn (array $file): DriveItem => DriveItem::fromApi($file), $this->state->files),
            fn (DriveItem $item): bool => ! $item->trashed && in_array($folderId, $item->parents, true),
        ));

        usort($children, fn (DriveItem $a, DriveItem $b): int => [! $a->isFolder(), $a->name] <=> [! $b->isFolder(), $b->name]);

        return $children;
    }

    public function createFolder(string $name, string $parentId, array $appProperties = []): DriveItem
    {
        $this->record('files.create_folder', ['name' => $name, 'parentId' => $parentId, 'appProperties' => $appProperties]);

        return $this->store($name, DriveFileKind::FOLDER_MIME, $parentId, 'files.create_folder', appProperties: $appProperties);
    }

    public function createFile(string $name, string $mimeType, string $parentId): DriveItem
    {
        $this->record('files.create', ['name' => $name, 'mimeType' => $mimeType, 'parentId' => $parentId]);

        return $this->store($name, $mimeType, $parentId, 'files.create');
    }

    public function rename(string $fileId, string $name): DriveItem
    {
        $this->record('files.update', ['fileId' => $fileId, 'name' => $name]);
        $this->fileOrFail($fileId, 'files.update');

        $this->state->files[$fileId]['name'] = $name;
        $this->state->files[$fileId]['modifiedTime'] = now()->toIso8601ZuluString();
        $this->save();

        return DriveItem::fromApi($this->state->files[$fileId]);
    }

    public function deleteFile(string $fileId): void
    {
        $this->record('files.delete', ['fileId' => $fileId]);
        $this->fileOrFail($fileId, 'files.delete');

        unset($this->state->files[$fileId], $this->state->permissions[$fileId]);
        $this->save();
    }

    public function listPermissions(string $fileId): array
    {
        $this->record('permissions.list', ['fileId' => $fileId]);
        $this->fileOrFail($fileId, 'permissions.list');

        return array_map(
            fn (array $permission): DrivePermission => DrivePermission::fromApi($permission),
            $this->state->permissions[$fileId] ?? [],
        );
    }

    public function createPermission(string $fileId, string $email, DriveRole $role, bool $notify = false): DrivePermission
    {
        $this->record('permissions.create', ['fileId' => $fileId, 'email' => strtolower($email), 'role' => $role->value, 'notify' => $notify]);
        $this->fileOrFail($fileId, 'permissions.create');

        if (! str_contains($email, '@')) {
            throw new DriveRequestFailed('permissions.create', 400, 'invalidSharingRequest', 'Bad Request. User message: "invalid email"');
        }

        foreach ($this->state->permissions[$fileId] ?? [] as $index => $existing) {
            $permission = DrivePermission::fromApi($existing);

            if ($permission->email() === strtolower($email)) {
                $updated = new DrivePermission($permission->id, 'user', $role->value, $permission->emailAddress, $permission->inherited, true);
                $this->state->permissions[$fileId][$index] = $updated->toApi();
                $this->save();

                return $updated;
            }
        }

        $permission = new DrivePermission('perm-'.$this->nextId(), 'user', $role->value, $email);
        $this->state->permissions[$fileId][] = $permission->toApi();
        $this->save();

        return $permission;
    }

    public function updatePermission(string $fileId, string $permissionId, DriveRole $role): DrivePermission
    {
        $this->record('permissions.update', ['fileId' => $fileId, 'permissionId' => $permissionId, 'role' => $role->value]);
        $index = $this->permissionIndex($fileId, $permissionId, 'permissions.update');

        $current = DrivePermission::fromApi($this->state->permissions[$fileId][$index]);
        $updated = new DrivePermission($current->id, $current->type, $role->value, $current->emailAddress, $current->inherited, $current->direct);
        $this->state->permissions[$fileId][$index] = $updated->toApi();
        $this->save();

        return $updated;
    }

    public function deletePermission(string $fileId, string $permissionId): void
    {
        $this->record('permissions.delete', ['fileId' => $fileId, 'permissionId' => $permissionId]);
        $index = $this->permissionIndex($fileId, $permissionId, 'permissions.delete');

        array_splice($this->state->permissions[$fileId], $index, 1);
        $this->save();
    }

    public function startResumableUpload(string $name, string $mimeType, int $size, string $parentId): string
    {
        $this->record('upload.start', ['name' => $name, 'mimeType' => $mimeType, 'size' => $size, 'parentId' => $parentId]);
        $this->assertParentExists($parentId, 'upload.start');

        $uri = 'https://fake.drive.test/upload/session-'.$this->nextId();
        $this->state->uploads[$uri] = [
            'name' => $name,
            'mimeType' => $mimeType,
            'size' => $size,
            'parentId' => $parentId,
            'received' => 0,
            'fileId' => null,
        ];
        $this->save();

        return $uri;
    }

    public function uploadChunk(string $sessionUri, string $bytes, int $offset, int $total): UploadProgress
    {
        $this->record('upload.chunk', ['session' => $sessionUri, 'offset' => $offset, 'length' => strlen($bytes), 'total' => $total]);
        $upload = $this->uploadOrFail($sessionUri, 'upload.chunk');

        if ($upload['fileId'] !== null) {
            return UploadProgress::completed(DriveItem::fromApi($this->state->files[$upload['fileId']]), $total);
        }

        if ($offset !== $upload['received']) {
            return UploadProgress::incomplete($upload['received']);
        }

        $received = $upload['received'] + strlen($bytes);
        $upload['received'] = $received;
        $this->state->uploads[$sessionUri] = $upload;

        if ($this->persist === null) {
            $this->state->contents[$sessionUri] = ($this->state->contents[$sessionUri] ?? '').$bytes;
        }

        if ($received < $total) {
            $this->save();

            return UploadProgress::incomplete($received);
        }

        $item = $this->store($upload['name'], $upload['mimeType'], $upload['parentId'], 'upload.chunk', size: $total);
        $upload['fileId'] = $item->id;
        $this->state->uploads[$sessionUri] = $upload;

        if (isset($this->state->contents[$sessionUri])) {
            $this->state->contents[$item->id] = $this->state->contents[$sessionUri];
            unset($this->state->contents[$sessionUri]);
        }

        $this->save();

        return UploadProgress::completed($item, $total);
    }

    public function uploadStatus(string $sessionUri, int $total): UploadProgress
    {
        $this->record('upload.status', ['session' => $sessionUri, 'total' => $total]);
        $upload = $this->uploadOrFail($sessionUri, 'upload.status');

        return $upload['fileId'] !== null
            ? UploadProgress::completed(DriveItem::fromApi($this->state->files[$upload['fileId']]), $total)
            : UploadProgress::incomplete($upload['received']);
    }

    // ---------------------------------------------------------------------
    // Seeding & failure injection
    // ---------------------------------------------------------------------

    /**
     * @param  array<string, string>  $appProperties
     */
    public function seedFolder(string $name, ?string $parentId = null, array $appProperties = []): DriveItem
    {
        return $this->store($name, DriveFileKind::FOLDER_MIME, $parentId ?? $this->sharedDriveId(), null, appProperties: $appProperties);
    }

    public function seedFile(string $name, string $mimeType, string $parentId, ?int $size = null, ?string $ownerEmail = null): DriveItem
    {
        return $this->store($name, $mimeType, $parentId, null, size: $size, ownerEmail: $ownerEmail);
    }

    /**
     * Inherited permissions model Shared Drive membership (never revoked by sync).
     */
    public function seedPermission(string $fileId, string $email, DriveRole|string $role, bool $inherited = false, string $type = 'user'): DrivePermission
    {
        $permission = new DrivePermission(
            'perm-'.$this->nextId(),
            $type,
            $role instanceof DriveRole ? $role->value : $role,
            $email,
            $inherited,
            ! $inherited,
        );

        $this->state->permissions[$fileId][] = $permission->toApi();
        $this->save();

        return $permission;
    }

    public function trash(string $fileId): void
    {
        $this->state->files[$fileId]['trashed'] = true;
        $this->save();
    }

    /**
     * Simulates a file deleted outside RuangKerja (subsequent calls get 404).
     */
    public function forget(string $fileId): void
    {
        unset($this->state->files[$fileId], $this->state->permissions[$fileId]);
        $this->save();
    }

    /**
     * Simulates an expired resumable session (subsequent calls get 404).
     */
    public function expireUploadSession(string $sessionUri): void
    {
        unset($this->state->uploads[$sessionUri]);
        $this->save();
    }

    /**
     * Makes the next `$times` calls of `$operation` (optionally only those
     * whose recorded arguments match `$when`) throw DriveRequestFailed.
     *
     * @param  (Closure(array<string, mixed>): bool)|null  $when
     */
    public function failNext(string $operation, int $status = 500, ?string $reason = null, ?int $retryAfter = null, int $times = 1, ?Closure $when = null): self
    {
        $this->state->failures[] = [
            'operation' => $operation,
            'status' => $status,
            'reason' => $reason,
            'retryAfter' => $retryAfter,
            'remaining' => $times,
            'when' => $when,
        ];

        return $this;
    }

    public function rateLimitNext(string $operation, int $times = 1, ?int $retryAfter = null): self
    {
        return $this->failNext($operation, 429, 'rateLimitExceeded', $retryAfter, $times);
    }

    // ---------------------------------------------------------------------
    // Inspection & assertions
    // ---------------------------------------------------------------------

    public function sharedDriveId(): string
    {
        return (string) array_key_first($this->state->sharedDrives);
    }

    public function file(string $fileId): ?DriveItem
    {
        return isset($this->state->files[$fileId]) ? DriveItem::fromApi($this->state->files[$fileId]) : null;
    }

    /**
     * @return list<DriveItem>
     */
    public function folders(): array
    {
        return array_values(array_filter(
            array_map(fn (array $file): DriveItem => DriveItem::fromApi($file), $this->state->files),
            fn (DriveItem $item): bool => $item->isFolder(),
        ));
    }

    /**
     * @return list<DriveItem>
     */
    public function files(): array
    {
        return array_values(array_filter(
            array_map(fn (array $file): DriveItem => DriveItem::fromApi($file), $this->state->files),
            fn (DriveItem $item): bool => ! $item->isFolder(),
        ));
    }

    /**
     * @return list<DrivePermission>
     */
    public function permissionsFor(string $fileId): array
    {
        return array_map(
            fn (array $permission): DrivePermission => DrivePermission::fromApi($permission),
            $this->state->permissions[$fileId] ?? [],
        );
    }

    /**
     * Direct user permissions as e-mail => role, sorted by e-mail.
     *
     * @return array<string, string>
     */
    public function directAccess(string $fileId): array
    {
        $access = [];

        foreach ($this->permissionsFor($fileId) as $permission) {
            if ($permission->isManagedUser()) {
                $access[(string) $permission->email()] = $permission->role;
            }
        }

        ksort($access);

        return $access;
    }

    public function uploadedContent(string $fileId): ?string
    {
        return $this->state->contents[$fileId] ?? null;
    }

    /**
     * @return list<array{operation: string, actor: string, arguments: array<string, mixed>}>
     */
    public function calls(?string $operation = null): array
    {
        return array_values(array_filter(
            $this->state->calls,
            fn (array $call): bool => $operation === null || $call['operation'] === $operation,
        ));
    }

    public function resetCalls(): self
    {
        $this->state->calls = [];

        return $this;
    }

    public function assertCalled(string $operation, ?int $times = null): void
    {
        $count = count($this->calls($operation));

        $times === null
            ? Assert::assertGreaterThan(0, $count, "Drive operation [{$operation}] was not called.")
            : Assert::assertSame($times, $count, "Drive operation [{$operation}] was called {$count} times instead of {$times}.");
    }

    public function assertNotCalled(string $operation): void
    {
        $this->assertCalled($operation, 0);
    }

    /**
     * No mutating call (folders, files, permissions, uploads) happened.
     */
    public function assertNoWrites(): void
    {
        $writes = array_filter(
            $this->state->calls,
            fn (array $call): bool => ! in_array($call['operation'], ['drives.get', 'files.get', 'files.list', 'permissions.list', 'upload.status'], true),
        );

        Assert::assertSame([], array_column($writes, 'operation'), 'Unexpected Drive writes.');
    }

    public function assertNothingCalled(): void
    {
        Assert::assertSame([], array_column($this->state->calls, 'operation'), 'Unexpected Drive calls.');
    }

    public function assertFolderCreated(string $name, ?string $parentId = null): DriveItem
    {
        $found = null;

        foreach ($this->folders() as $folder) {
            if ($folder->name === $name && ($parentId === null || in_array($parentId, $folder->parents, true))) {
                $found = $folder;

                break;
            }
        }

        Assert::assertNotNull($found, "Drive folder [{$name}] was not created.");

        return $found;
    }

    public function assertFolderCount(int $count): void
    {
        Assert::assertCount($count, $this->folders(), 'Unexpected number of Drive folders.');
    }

    public function assertFileCreated(string $name, ?string $mimeType = null, ?string $parentId = null): DriveItem
    {
        $found = null;

        foreach ($this->files() as $file) {
            if ($file->name === $name
                && ($mimeType === null || $file->mimeType === $mimeType)
                && ($parentId === null || in_array($parentId, $file->parents, true))) {
                $found = $file;

                break;
            }
        }

        Assert::assertNotNull($found, "Drive file [{$name}] was not created.");

        return $found;
    }

    public function assertPermission(string $fileId, string $email, DriveRole $role): void
    {
        $access = $this->directAccess($fileId);
        $email = strtolower($email);

        Assert::assertArrayHasKey($email, $access, "[{$email}] has no direct permission on [{$fileId}].");
        Assert::assertSame($role->value, $access[$email], "[{$email}] has role [{$access[$email]}] instead of [{$role->value}].");
    }

    public function assertNoPermission(string $fileId, string $email): void
    {
        Assert::assertArrayNotHasKey(strtolower($email), $this->directAccess($fileId), "[{$email}] still has a direct permission on [{$fileId}].");
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    /**
     * @param  array<string, string>  $appProperties
     */
    private function store(string $name, string $mimeType, string $parentId, ?string $operation, ?int $size = null, array $appProperties = [], ?string $ownerEmail = null): DriveItem
    {
        $driveId = $this->assertParentExists($parentId, $operation ?? 'seed');
        $kind = DriveFileKind::fromMimeType($mimeType);
        $id = ($kind === DriveFileKind::Folder ? 'fake-folder-' : 'fake-file-').$this->nextId();

        $item = new DriveItem(
            id: $id,
            name: $name,
            mimeType: $mimeType,
            webViewLink: self::webViewLink($id, $kind),
            iconLink: 'https://drive-thirdparty.googleusercontent.com/16/type/'.$mimeType,
            size: $kind->isGoogleNative() || $kind === DriveFileKind::Folder ? null : $size,
            ownerEmail: $ownerEmail,
            modifiedAt: now()->toImmutable(),
            parents: [$parentId],
            appProperties: $appProperties,
            driveId: $driveId,
        );

        $this->state->files[$id] = $item->toApi();
        $this->save();

        return $item;
    }

    /**
     * @return string|null Shared Drive id of the parent
     */
    private function assertParentExists(string $parentId, string $operation): ?string
    {
        if (isset($this->state->sharedDrives[$parentId])) {
            return $parentId;
        }

        $parent = $this->state->files[$parentId] ?? null;

        if ($parent === null || ($parent['mimeType'] ?? null) !== DriveFileKind::FOLDER_MIME) {
            throw $this->notFound($operation);
        }

        return is_string($parent['driveId'] ?? null) ? $parent['driveId'] : null;
    }

    /**
     * @return array<string, mixed>
     */
    private function fileOrFail(string $fileId, string $operation): array
    {
        return $this->state->files[$fileId] ?? throw $this->notFound($operation);
    }

    /**
     * @return array{name: string, mimeType: string, size: int, parentId: string, received: int, fileId: string|null}
     */
    private function uploadOrFail(string $sessionUri, string $operation): array
    {
        return $this->state->uploads[$sessionUri] ?? throw $this->notFound($operation);
    }

    private function permissionIndex(string $fileId, string $permissionId, string $operation): int
    {
        $this->fileOrFail($fileId, $operation);

        foreach ($this->state->permissions[$fileId] ?? [] as $index => $permission) {
            if (($permission['id'] ?? null) === $permissionId) {
                return $index;
            }
        }

        throw $this->notFound($operation);
    }

    /**
     * @param  array<string, mixed>  $arguments
     */
    private function record(string $operation, array $arguments): void
    {
        $this->state->calls[] = ['operation' => $operation, 'actor' => $this->actor, 'arguments' => $arguments];

        foreach ($this->state->failures as $index => $failure) {
            if ($failure['operation'] !== $operation || $failure['remaining'] < 1) {
                continue;
            }

            if ($failure['when'] !== null && ! ($failure['when'])($arguments)) {
                continue;
            }

            $this->state->failures[$index]['remaining']--;

            throw new DriveRequestFailed($operation, $failure['status'], $failure['reason'], 'Injected by FakeDriveClient', $failure['retryAfter']);
        }
    }

    private function notFound(string $operation): DriveRequestFailed
    {
        return new DriveRequestFailed($operation, 404, 'notFound', 'File not found.');
    }

    private function nextId(): int
    {
        return ++$this->state->sequence;
    }

    private function save(): void
    {
        $this->persist?->forever(self::CACHE_KEY, $this->state->export());
    }

    private static function webViewLink(string $id, DriveFileKind $kind): string
    {
        return match ($kind) {
            DriveFileKind::Doc => "https://docs.google.com/document/d/{$id}/edit",
            DriveFileKind::Sheet => "https://docs.google.com/spreadsheets/d/{$id}/edit",
            DriveFileKind::Slide => "https://docs.google.com/presentation/d/{$id}/edit",
            DriveFileKind::Folder => "https://drive.google.com/drive/folders/{$id}",
            default => "https://drive.google.com/file/d/{$id}/view",
        };
    }
}
