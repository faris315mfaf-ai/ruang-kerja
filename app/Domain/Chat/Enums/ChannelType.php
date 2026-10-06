<?php

namespace App\Domain\Chat\Enums;

/**
 * channels.type (docs/DATABASE.md §7): one automatic channel per non-personal
 * workspace, free channels (public = every employee of the company, private =
 * members only) and direct conversations (dm = 2 people, group = 3+).
 */
enum ChannelType: string
{
    case Workspace = 'workspace';
    case Public = 'public';
    case Private = 'private';
    case Dm = 'dm';
    case Group = 'group';

    public function label(): string
    {
        return match ($this) {
            self::Workspace => 'Channel workspace',
            self::Public => 'Channel publik',
            self::Private => 'Channel privat',
            self::Dm => 'Pesan langsung',
            self::Group => 'Grup',
        };
    }

    /** DM and group: no name, identified by their members (direct_key). */
    public function isDirect(): bool
    {
        return $this === self::Dm || $this === self::Group;
    }

    /** Only members may read these (decision 6 Oct 2026: not even Super Admin, HR or Direksi). */
    public function isMembersOnly(): bool
    {
        return $this === self::Private || $this->isDirect();
    }
}
