<?php

namespace App\Domain\Tasks\Enums;

/**
 * Category of a board column. Dashboard metrics always use the category,
 * never the column name (PRD M4).
 */
enum TaskStatusCategory: string
{
    case Backlog = 'backlog';
    case Todo = 'todo';
    case InProgress = 'in_progress';
    case Review = 'review';
    case Done = 'done';
    case Canceled = 'canceled';

    public function label(): string
    {
        return match ($this) {
            self::Backlog => 'Backlog',
            self::Todo => 'Todo',
            self::InProgress => 'Sedang dikerjakan',
            self::Review => 'Review',
            self::Done => 'Selesai',
            self::Canceled => 'Dibatalkan',
        };
    }

    /** Default palette color for a new column of this category. */
    public function defaultColor(): string
    {
        return match ($this) {
            self::Backlog, self::Canceled => 'gray',
            self::Todo => 'slate',
            self::InProgress => 'amber',
            self::Review => 'blue',
            self::Done => 'teal',
        };
    }

    /** Done or canceled: no longer counts as open work. */
    public function isClosed(): bool
    {
        return $this === self::Done || $this === self::Canceled;
    }

    /** Work has started (sets tasks.started_at the first time). */
    public function isStarted(): bool
    {
        return $this === self::InProgress || $this === self::Review;
    }

    /**
     * @return list<string>
     */
    public static function closedValues(): array
    {
        return [self::Done->value, self::Canceled->value];
    }
}
