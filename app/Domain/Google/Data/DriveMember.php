<?php

namespace App\Domain\Google\Data;

use App\Domain\Google\Enums\DriveRole;

/**
 * Desired access of one person on a Drive folder.
 */
final readonly class DriveMember
{
    public string $email;

    public function __construct(string $email, public DriveRole $role)
    {
        $this->email = strtolower(trim($email));
    }

    /**
     * Convenience for workspace members: owner/admin/member → writer, viewer → reader.
     */
    public static function forWorkspaceRole(string $email, string $workspaceRole): self
    {
        return new self($email, DriveRole::forWorkspaceRole($workspaceRole));
    }
}
