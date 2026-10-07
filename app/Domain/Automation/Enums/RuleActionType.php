<?php

namespace App\Domain\Automation\Enums;

/**
 * "Maka …" of an automation rule (one entry of automation_rules.actions).
 * WhatsApp is deliberately not an action (held by the owner, Oct 2026):
 * "beri tahu" goes through the normal notification channels.
 */
enum RuleActionType: string
{
    case Notify = 'notify';
    case Assign = 'assign';
    case AddLabel = 'add_label';
    case MoveStatus = 'move_status';

    public function label(): string
    {
        return match ($this) {
            self::Notify => 'Beri tahu',
            self::Assign => 'Tugaskan ke',
            self::AddLabel => 'Tambah label',
            self::MoveStatus => 'Pindahkan ke kolom',
        };
    }

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return array_map(fn (self $case): string => $case->value, self::cases());
    }
}
