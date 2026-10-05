<?php

namespace App\Domain\Tasks\Enums;

/**
 * saved_views.layout — the workspace task views.
 */
enum SavedViewLayout: string
{
    case Board = 'board';
    case List = 'list';
    case Calendar = 'calendar';

    public function label(): string
    {
        return match ($this) {
            self::Board => 'Board',
            self::List => 'List',
            self::Calendar => 'Kalender',
        };
    }
}
