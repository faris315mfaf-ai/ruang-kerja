<?php

namespace App\Domain\Requests\Enums;

/**
 * Metrics a flow step condition can test. Stored as `<metric>_<operator>` keys in
 * approval_flow_steps.condition, e.g. {"overtime_month_minutes_gt": 2400}.
 */
enum ConditionMetric: string
{
    /** Overtime minutes in the request's month (pending + approved, this request included). */
    case OvertimeMonthMinutes = 'overtime_month_minutes';
    /** Working days of the request. */
    case Days = 'days';
    /** Minutes of the request (overtime / hourly permit). */
    case Minutes = 'minutes';

    public function label(): string
    {
        return match ($this) {
            self::OvertimeMonthMinutes => 'total lembur bulan ini',
            self::Days => 'jumlah hari kerja',
            self::Minutes => 'durasi pengajuan',
        };
    }

    /**
     * Unit shown in the admin editor: minutes are edited as hours.
     */
    public function unit(): string
    {
        return $this === self::Days ? 'hari' : 'jam';
    }

    /**
     * @return list<array{value: string, label: string, unit: string}>
     */
    public static function options(): array
    {
        return array_map(
            fn (self $case): array => ['value' => $case->value, 'label' => $case->label(), 'unit' => $case->unit()],
            self::cases(),
        );
    }
}
