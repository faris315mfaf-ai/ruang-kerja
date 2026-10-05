<?php

namespace App\Domain\Analytics\MetricDefinitions;

/**
 * One dashboard metric (PRD M7 "Definisi metrik"): the single source of truth
 * for its formula and for the definition shown in the UI tooltip. There is
 * deliberately no composite "productivity score".
 */
interface MetricDefinition
{
    /** Stable key, also used by the frontend (e.g. `completion_rate`). */
    public function key(): string;

    /** Indonesian label. */
    public function label(): string;

    /** Indonesian one-sentence formula for the tooltip. */
    public function definition(): string;

    /** `percent`, `count`, `days` or `minutes`. */
    public function unit(): string;
}
