<?php

namespace App\Domain\Google\Data;

/**
 * What DrivePermissionSync changed on a folder.
 */
final class PermissionSyncResult
{
    /** @var list<string> */
    public array $added = [];

    /** @var list<string> */
    public array $updated = [];

    /** @var list<string> */
    public array $removed = [];

    /** @var array<string, string> e-mail => reason */
    public array $skipped = [];

    public function hasChanges(): bool
    {
        return $this->added !== [] || $this->updated !== [] || $this->removed !== [];
    }

    /**
     * @return array{added: int, updated: int, removed: int, skipped: int}
     */
    public function counts(): array
    {
        return [
            'added' => count($this->added),
            'updated' => count($this->updated),
            'removed' => count($this->removed),
            'skipped' => count($this->skipped),
        ];
    }
}
