<?php

namespace App\Domain\Automation\Services;

use App\Domain\Tasks\Enums\PaletteColor;
use App\Domain\Tasks\Enums\TaskStatusCategory;

/**
 * Reads the jsonb columns of task/workspace templates defensively (they are
 * written by our requests, but old or hand-edited rows must not break a page).
 */
final class TemplateShapes
{
    /**
     * @param  array<int, mixed>  $value
     * @return list<string>
     */
    public static function checklist(array $value): array
    {
        $lines = [];

        foreach ($value as $line) {
            if (is_string($line) && trim($line) !== '') {
                $lines[] = trim($line);
            }
        }

        return $lines;
    }

    /**
     * Unique by name (case-insensitive), unknown colours → gray.
     *
     * @param  array<int, mixed>  $value
     * @return list<array{name: string, color: string}>
     */
    public static function labels(array $value): array
    {
        $labels = [];
        $seen = [];

        foreach ($value as $label) {
            $name = is_array($label) && is_string($label['name'] ?? null) ? trim($label['name']) : '';

            if ($name === '' || isset($seen[mb_strtolower($name)])) {
                continue;
            }

            $seen[mb_strtolower($name)] = true;
            $labels[] = ['name' => $name, 'color' => self::color($label['color'] ?? null, PaletteColor::Gray->value)];
        }

        return $labels;
    }

    /**
     * Columns with a known category, in order.
     *
     * @param  array<int, mixed>  $value
     * @return list<array{name: string, category: string, color: string}>
     */
    public static function statuses(array $value): array
    {
        $statuses = [];

        foreach ($value as $status) {
            if (! is_array($status) || ! is_string($status['name'] ?? null) || trim($status['name']) === '') {
                continue;
            }

            $category = TaskStatusCategory::tryFrom(is_string($status['category'] ?? null) ? $status['category'] : '');

            if ($category === null) {
                continue;
            }

            $statuses[] = [
                'name' => trim($status['name']),
                'category' => $category->value,
                'color' => self::color($status['color'] ?? null, $category->defaultColor()),
            ];
        }

        return $statuses;
    }

    /**
     * LabelRef for the frontend (templates have no label ids: names are matched on use).
     *
     * @param  array<int, mixed>  $value
     * @return list<array{id: string, name: string, color: string}>
     */
    public static function labelRefs(array $value): array
    {
        return array_map(fn (array $label): array => [
            'id' => 'nama:'.mb_strtolower($label['name']),
            'name' => $label['name'],
            'color' => $label['color'],
        ], self::labels($value));
    }

    private static function color(mixed $value, string $fallback): string
    {
        $color = is_string($value) ? PaletteColor::tryFrom($value) : null;

        return $color === null ? $fallback : $color->value;
    }
}
