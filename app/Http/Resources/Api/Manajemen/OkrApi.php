<?php

namespace App\Http\Resources\Api\Manajemen;

use App\Domain\Analytics\Okr\KeyResultProgress;
use App\Domain\Analytics\Okr\ObjectiveProgress;
use App\Domain\Analytics\Okr\Quarter;
use App\Domain\Okr\Enums\OkrStatus;
use Carbon\CarbonInterface;

/**
 * Adds the computed OKR numbers (docs/fitur/okr.md §4, ObjectiveProgress /
 * KeyResultProgress — the server source of truth the web mirrors in
 * features/okr/lib.ts) to the presented objectives of OkrPresenter, so the
 * Android app does not reimplement the formulas. Fractions 0–1, rounded to
 * four decimals; `raw` may leave 0–1 (moved away from / past the target).
 */
final class OkrApi
{
    /**
     * The quarter header: "hari ke-13 dari 92", expected progress.
     *
     * @return array{key: string, label: string, start: string, end: string, days: int, day: int, elapsed: float, week: int, weeks: int}
     */
    public static function quarter(Quarter $quarter, CarbonInterface $today): array
    {
        $elapsed = $quarter->elapsed($today);
        $week = $quarter->week($today);

        return [
            'key' => $quarter->key(),
            'label' => $quarter->label(),
            'start' => $quarter->start()->toDateString(),
            'end' => $quarter->end()->toDateString(),
            'days' => $quarter->days(),
            // Quarter::elapsed() = days passed (today included) ÷ days, clamped.
            'day' => (int) round($elapsed * $quarter->days()),
            'elapsed' => round($elapsed, 4),
            'week' => $week['week'],
            'weeks' => $week['weeks'],
        ];
    }

    /**
     * One presented objective (OkrPresenter::summary / detail) with
     * `progress` and a `progress` on each key result.
     *
     * @param  array<string, mixed>  $objective
     * @return array<string, mixed>
     */
    public static function objective(array $objective, CarbonInterface $today): array
    {
        /** @var list<array<string, mixed>> $keyResults */
        $keyResults = $objective['key_results'] ?? [];
        $quarter = is_string($objective['quarter'] ?? null) ? Quarter::tryParse($objective['quarter']) : null;
        $quarter ??= Quarter::of($today);
        $expected = $quarter->elapsed($today);
        $values = array_map(self::values(...), $keyResults);
        $summary = ObjectiveProgress::summarize($values, $quarter, $today);

        $objective['key_results'] = array_map(function (array $kr) use ($expected): array {
            $values = self::values($kr);
            $status = ObjectiveProgress::keyResultStatus($values, $expected);

            return [...$kr, 'progress' => [
                'value' => round(KeyResultProgress::display($values['start'], $values['target'], $values['current']), 4),
                'raw' => round(KeyResultProgress::raw($values['start'], $values['target'], $values['current']), 4),
                'expected' => round($expected, 4),
                'status' => $status->value,
                'status_label' => $status->label(),
            ]];
        }, $keyResults);

        $objective['progress'] = [
            'value' => round($summary['progress'], 4),
            'expected' => round($summary['expected'], 4),
            'status' => $summary['status']->value,
            'status_label' => $summary['status']->label(),
            'regressed' => $summary['regressed'],
            'counts' => $summary['counts'],
        ];

        return $objective;
    }

    /**
     * KPI row of the list: average progress vs expected, objectives per status.
     *
     * @param  list<array<string, mixed>>  $objectives  already passed through objective()
     * @return array{count: int, average: float|null, expected: float, on_track: int, at_risk: int, behind: int}
     */
    public static function kpis(array $objectives, Quarter $quarter, CarbonInterface $today): array
    {
        $counts = [OkrStatus::OnTrack->value => 0, OkrStatus::AtRisk->value => 0, OkrStatus::Behind->value => 0];
        $sum = 0.0;

        foreach ($objectives as $objective) {
            /** @var array{value: float, status: string} $progress */
            $progress = $objective['progress'];
            $sum += $progress['value'];
            $counts[$progress['status']]++;
        }

        return [
            'count' => count($objectives),
            'average' => $objectives === [] ? null : round($sum / count($objectives), 4),
            'expected' => round($quarter->elapsed($today), 4),
            'on_track' => $counts[OkrStatus::OnTrack->value],
            'at_risk' => $counts[OkrStatus::AtRisk->value],
            'behind' => $counts[OkrStatus::Behind->value],
        ];
    }

    /**
     * @param  array<string, mixed>  $kr
     * @return array{start: float, target: float, current: float, weight: float}
     */
    private static function values(array $kr): array
    {
        return [
            'start' => is_numeric($kr['start_value'] ?? null) ? (float) $kr['start_value'] : 0.0,
            'target' => is_numeric($kr['target_value'] ?? null) ? (float) $kr['target_value'] : 0.0,
            'current' => is_numeric($kr['current_value'] ?? null) ? (float) $kr['current_value'] : 0.0,
            'weight' => is_numeric($kr['weight'] ?? null) ? (float) $kr['weight'] : 1.0,
        ];
    }
}
