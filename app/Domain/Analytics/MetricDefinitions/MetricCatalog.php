<?php

namespace App\Domain\Analytics\MetricDefinitions;

/**
 * All metric definitions, for tooltips and the export's "Definisi" sheet.
 */
final class MetricCatalog
{
    /**
     * @return list<MetricDefinition>
     */
    public static function all(): array
    {
        return [
            new CompletionRate,
            new OnTimeRate,
            new OverdueTasks,
            new Workload,
            new LeadTimeMedian,
            new AttendanceDiscipline,
            new AverageLateness,
        ];
    }

    /**
     * @return array<string, array{label: string, definition: string, unit: string}>
     */
    public static function definitions(): array
    {
        $definitions = [];

        foreach (self::all() as $metric) {
            $definitions[$metric->key()] = [
                'label' => $metric->label(),
                'definition' => $metric->definition(),
                'unit' => $metric->unit(),
            ];
        }

        return $definitions;
    }
}
