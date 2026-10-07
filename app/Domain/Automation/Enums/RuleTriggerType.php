<?php

namespace App\Domain\Automation\Enums;

/**
 * "Jika …" of an automation rule (automation_rules.trigger_type). Triggers use
 * the column category, never the column name (PRD M4).
 */
enum RuleTriggerType: string
{
    case TaskMoved = 'task_moved';
    case TaskOverdue = 'task_overdue';
    case TaskCreatedWithLabel = 'task_created_with_label';

    public function label(): string
    {
        return match ($this) {
            self::TaskMoved => 'Tugas pindah kolom',
            self::TaskOverdue => 'Tugas lewat tenggat',
            self::TaskCreatedWithLabel => 'Tugas dibuat berlabel',
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
