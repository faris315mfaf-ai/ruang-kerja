<?php

namespace App\Domain\RoleDashboards\Support;

/**
 * Builders for the blocks of a job dashboard (resources/js/features/role-dashboards/types.ts).
 * Values stay raw (numbers, ISO dates); the client formats them with
 * lib/format.ts. Notes and badges are short labels.
 */
final class Blocks
{
    /**
     * @param  'count'|'percent'  $unit
     * @param  'highlight'|'warm'|'plain'  $tone
     * @return array{label: string, value: int|float|null, total: int|null, unit: string, note: string, tone: string}
     */
    public static function kpi(string $label, int|float|null $value, string $note, string $tone = 'plain', ?int $total = null, string $unit = 'count'): array
    {
        return ['label' => $label, 'value' => $value, 'total' => $total, 'unit' => $unit, 'note' => $note, 'tone' => $tone];
    }

    /**
     * @param  'late'|'warn'|'info'|'ok'|'neutral'  $tone
     * @param  array{value: string, style: 'relative'|'date'}|null  $at
     * @return array<string, mixed>
     */
    public static function row(string $id, string $tag, string $title, string $meta, string $badge, string $tone, ?string $href = null, bool $flow = false, ?array $at = null): array
    {
        return [
            'id' => $id,
            'tag' => mb_strtoupper(mb_substr($tag, 0, 4)),
            'title' => $title,
            'meta' => $meta,
            'badge' => $badge,
            'tone' => $tone,
            'href' => $href,
            'flow' => $flow,
            'at' => $at,
        ];
    }

    /**
     * @param  'late'|'warn'|'ok'|'neutral'  $tone
     * @return array<string, mixed>
     */
    public static function bar(string $id, string $name, string $sub, float $value, ?float $plan, string $note, string $tone, ?string $href = null): array
    {
        return [
            'id' => $id,
            'name' => $name,
            'sub' => $sub,
            'value' => round(max(0, min(100, $value)), 1),
            'plan' => $plan === null ? null : round(max(0, min(100, $plan)), 1),
            'note' => $note,
            'tone' => $tone,
            'href' => $href,
        ];
    }

    /**
     * @param  'task'|'milestone'|'leave'  $kind
     * @return array<string, mixed>
     */
    public static function event(string $id, string $date, string $title, string $kind, string $meta, ?string $href = null): array
    {
        return ['id' => $id, 'date' => $date, 'title' => $title, 'kind' => $kind, 'meta' => $meta, 'href' => $href];
    }

    /**
     * @return array{label: string, href: string|null, flow: bool}
     */
    public static function link(string $label, string $href): array
    {
        return ['label' => $label, 'href' => $href, 'flow' => false];
    }

    /**
     * @return array{label: string, href: string|null, flow: bool}
     */
    public static function flow(string $label): array
    {
        return ['label' => $label, 'href' => null, 'flow' => true];
    }

    /** "4 sesuai jalur · 1 berisiko" — parts with a zero count are left out. */
    public static function join(string ...$parts): string
    {
        return implode(' · ', array_values(array_filter($parts, fn (string $part): bool => $part !== '')));
    }

    /** "3 terlambat", or '' when the count is zero (for join()). */
    public static function count(int $count, string $label): string
    {
        return $count > 0 ? "{$count} {$label}" : '';
    }

    /**
     * Health of a project → bar/row tone.
     *
     * @return 'late'|'warn'|'ok'|'neutral'
     */
    public static function healthTone(?string $health): string
    {
        return match ($health) {
            'off_track' => 'late',
            'at_risk' => 'warn',
            'on_track' => 'ok',
            default => 'neutral',
        };
    }
}
