<?php

namespace App\Domain\Google\Data;

/**
 * Outcome of DriveFolderService::ensure().
 */
final readonly class FolderResult
{
    public function __construct(
        public string $folderId,
        public bool $created = false,
        public bool $renamed = false,
        public bool $recovered = false,
    ) {}

    /**
     * A new or recovered folder may lack member permissions.
     */
    public function needsPermissionSync(): bool
    {
        return $this->created || $this->recovered;
    }
}
