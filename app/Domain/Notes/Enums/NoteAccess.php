<?php

namespace App\Domain\Notes\Enums;

/**
 * notes.access: who opens a note besides the people in note_shares.
 * `workspace` = everyone who can see the workspace, `restricted` = only the
 * author and the invited people (no global role sees it automatically).
 */
enum NoteAccess: string
{
    case Workspace = 'workspace';
    case Restricted = 'restricted';

    public function label(): string
    {
        return match ($this) {
            self::Workspace => 'Workspace',
            self::Restricted => 'Hanya diundang',
        };
    }
}
