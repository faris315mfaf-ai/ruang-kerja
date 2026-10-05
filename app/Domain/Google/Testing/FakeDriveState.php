<?php

namespace App\Domain\Google\Testing;

/**
 * Mutable state shared by every FakeDriveClient view (service account and
 * per-user actors see the same fake Drive).
 *
 * @internal
 */
final class FakeDriveState
{
    /** @var array<string, string> Shared Drive id => name */
    public array $sharedDrives = [];

    /** @var array<string, array<string, mixed>> file id => Drive v3 File resource */
    public array $files = [];

    /** @var array<string, list<array<string, mixed>>> file id => Permission resources */
    public array $permissions = [];

    /** @var array<string, array{name: string, mimeType: string, size: int, parentId: string, received: int, fileId: string|null}> */
    public array $uploads = [];

    /** @var array<string, string> file id => uploaded bytes (tests only) */
    public array $contents = [];

    /** @var list<array{operation: string, actor: string, arguments: array<string, mixed>}> */
    public array $calls = [];

    /** @var list<array{operation: string, status: int, reason: string|null, retryAfter: int|null, remaining: int, when: (\Closure(array<string, mixed>): bool)|null}> */
    public array $failures = [];

    public int $sequence = 0;

    /**
     * Persistable part of the state (no closures, no call log).
     *
     * @return array<string, mixed>
     */
    public function export(): array
    {
        return [
            'sharedDrives' => $this->sharedDrives,
            'files' => $this->files,
            'permissions' => $this->permissions,
            'uploads' => $this->uploads,
            'sequence' => $this->sequence,
        ];
    }

    /**
     * @param  array<array-key, mixed>  $data
     */
    public function import(array $data): void
    {
        /** @var array<string, string> $sharedDrives */
        $sharedDrives = is_array($data['sharedDrives'] ?? null) ? $data['sharedDrives'] : [];
        /** @var array<string, array<string, mixed>> $files */
        $files = is_array($data['files'] ?? null) ? $data['files'] : [];
        /** @var array<string, list<array<string, mixed>>> $permissions */
        $permissions = is_array($data['permissions'] ?? null) ? $data['permissions'] : [];
        /** @var array<string, array{name: string, mimeType: string, size: int, parentId: string, received: int, fileId: string|null}> $uploads */
        $uploads = is_array($data['uploads'] ?? null) ? $data['uploads'] : [];

        $this->sharedDrives = $sharedDrives + $this->sharedDrives;
        $this->files = $files;
        $this->permissions = $permissions;
        $this->uploads = $uploads;
        $this->sequence = is_int($data['sequence'] ?? null) ? $data['sequence'] : 0;
    }
}
