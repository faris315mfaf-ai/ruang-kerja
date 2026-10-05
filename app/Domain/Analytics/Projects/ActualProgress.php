<?php

namespace App\Domain\Analytics\Projects;

/**
 * Progres aktual (PRD M10): done tasks ÷ all non-canceled tasks of the project
 * workspace, in percent (0–100).
 *
 * When at least 80% of the scope has an estimate (estimate_hours > 0) the
 * tasks are weighted by their estimate. Tasks without an estimate then weigh
 * the average estimate of the estimated ones, so they still count.
 * No tasks → null (nothing to measure yet).
 */
final class ActualProgress
{
    /** Share of the scope that must have an estimate to switch to hours. */
    public const float ESTIMATE_COVERAGE = 0.8;

    public static function usesEstimates(TaskTotals $totals): bool
    {
        return $totals->scope > 0
            && $totals->estimatedHours > 0
            && $totals->estimated / $totals->scope >= self::ESTIMATE_COVERAGE;
    }

    public static function calculate(TaskTotals $totals): ?float
    {
        if ($totals->scope === 0) {
            return null;
        }

        if (! self::usesEstimates($totals)) {
            return self::clamp($totals->done / $totals->scope * 100);
        }

        $average = $totals->estimatedHours / $totals->estimated;
        $total = $totals->estimatedHours + ($totals->scope - $totals->estimated) * $average;
        $done = $totals->doneEstimatedHours + ($totals->done - $totals->doneEstimated) * $average;

        return self::clamp($done / $total * 100);
    }

    public static function clamp(float $percent): float
    {
        return round(max(0.0, min(100.0, $percent)), 2);
    }
}
