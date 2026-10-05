<?php

namespace App\Domain\Projects\Enums;

/**
 * Project lifecycle (workspaces.project_status, PRD M10).
 */
enum ProjectStatus: string
{
    case Planned = 'planned';
    case Active = 'active';
    case OnHold = 'on_hold';
    case Completed = 'completed';
    case Canceled = 'canceled';

    public function label(): string
    {
        return match ($this) {
            self::Planned => 'Direncanakan',
            self::Active => 'Berjalan',
            self::OnHold => 'Ditunda',
            self::Completed => 'Selesai',
            self::Canceled => 'Dibatalkan',
        };
    }

    /**
     * Still being worked on or about to start: tracked by snapshots and reminders.
     */
    public function isOpen(): bool
    {
        return in_array($this, [self::Planned, self::Active, self::OnHold], true);
    }

    /**
     * @return list<string>
     */
    public static function openValues(): array
    {
        return [self::Planned->value, self::Active->value, self::OnHold->value];
    }
}
