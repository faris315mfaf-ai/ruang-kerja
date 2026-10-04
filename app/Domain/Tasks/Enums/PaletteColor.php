<?php

namespace App\Domain\Tasks\Enums;

/**
 * Palette names stored in labels.color, task_statuses.color and
 * workspaces.color (resources/css/palette.css, resources/js/lib/palette.ts).
 */
enum PaletteColor: string
{
    case Gray = 'gray';
    case Slate = 'slate';
    case Teal = 'teal';
    case Blue = 'blue';
    case Green = 'green';
    case Amber = 'amber';
    case Orange = 'orange';
    case Red = 'red';
    case Violet = 'violet';
    case Pink = 'pink';
}
