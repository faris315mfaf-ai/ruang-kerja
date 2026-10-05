<?php

namespace App\Domain\Workspaces\Enums;

enum WorkspaceVisibility: string
{
    /** Only members (and Direksi for non-personal workspaces) can see it. */
    case Private = 'private';

    /** Every employee can see it; only members can change it. */
    case Internal = 'internal';

    public function label(): string
    {
        return match ($this) {
            self::Private => 'Private',
            self::Internal => 'Internal',
        };
    }
}
