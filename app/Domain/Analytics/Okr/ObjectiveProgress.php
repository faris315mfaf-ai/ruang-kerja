<?php

namespace App\Domain\Analytics\Okr;

use App\Domain\Okr\Enums\OkrStatus;
use Carbon\CarbonInterface;

/**
 * Objective progress & status (docs/fitur/okr.md §4), one source of truth for
 * the server (reminders, "objective berisiko") and mirrored by
 * summarizeObjective() in resources/js/features/okr/lib.ts:
 *
 * - progress = weighted average of key result progress (0–1 each; weights
 *   ≤ 0 everywhere fall back to equal shares);
 * - status = progress (key results clamped to −1…1) − share of the quarter
 *   passed (office date): ≥ −10 points on track, ≥ −25 points at risk,
 *   otherwise behind.
 *
 * @phpstan-type KrValues array{start: float, target: float, current: float, weight: float}
 */
final class ObjectiveProgress
{
    public const float AT_RISK_GAP = -0.10;

    public const float BEHIND_GAP = -0.25;

    public static function statusFor(float $progress, float $elapsed): OkrStatus
    {
        // Rounded so 0.5 − 0.6 counts as exactly −10 points (float noise).
        $gap = round($progress - $elapsed, 9);

        if ($gap >= self::AT_RISK_GAP) {
            return OkrStatus::OnTrack;
        }

        return $gap >= self::BEHIND_GAP ? OkrStatus::AtRisk : OkrStatus::Behind;
    }

    /**
     * @param  KrValues  $kr
     */
    public static function keyResultStatus(array $kr, float $elapsed): OkrStatus
    {
        return self::statusFor(KeyResultProgress::forStatus($kr['start'], $kr['target'], $kr['current']), $elapsed);
    }

    /**
     * @param  list<KrValues>  $keyResults
     */
    public static function weighted(array $keyResults, bool $forStatus = false): float
    {
        if ($keyResults === []) {
            return 0.0;
        }

        $total = array_sum(array_map(fn (array $kr): float => max(0.0, $kr['weight']), $keyResults));
        $sum = 0.0;

        foreach ($keyResults as $kr) {
            $share = $total > 0 ? max(0.0, $kr['weight']) / $total : 1 / count($keyResults);
            $value = $forStatus
                ? KeyResultProgress::forStatus($kr['start'], $kr['target'], $kr['current'])
                : KeyResultProgress::display($kr['start'], $kr['target'], $kr['current']);
            $sum += $value * $share;
        }

        return $sum;
    }

    /**
     * @param  list<KrValues>  $keyResults
     * @return array{progress: float, status: OkrStatus, expected: float, regressed: int, counts: array<string, int>}
     */
    public static function summarize(array $keyResults, Quarter $quarter, CarbonInterface $today): array
    {
        $expected = $quarter->elapsed($today);
        $counts = [OkrStatus::OnTrack->value => 0, OkrStatus::AtRisk->value => 0, OkrStatus::Behind->value => 0];
        $regressed = 0;

        foreach ($keyResults as $kr) {
            $counts[self::keyResultStatus($kr, $expected)->value]++;

            if (KeyResultProgress::raw($kr['start'], $kr['target'], $kr['current']) < 0) {
                $regressed++;
            }
        }

        return [
            'progress' => self::weighted($keyResults),
            'status' => self::statusFor(self::weighted($keyResults, true), $expected),
            'expected' => $expected,
            'regressed' => $regressed,
            'counts' => $counts,
        ];
    }
}
