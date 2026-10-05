<?php

namespace App\Domain\Requests\Services;

use App\Domain\Requests\Enums\ConditionMetric;
use App\Domain\Requests\Enums\ConditionOperator;
use App\Domain\Requests\Enums\RequestCategory;
use App\Domain\Requests\Enums\RequestStatus;
use App\Domain\Requests\Support\OfficeTime;
use App\Models\EmployeeRequest;
use Illuminate\Database\Eloquent\Builder;

/**
 * Evaluates approval_flow_steps.condition: every `<metric>_<op>` key must hold,
 * e.g. {"overtime_month_minutes_gt": 2400} = overtime this month > 40 hours.
 */
final class ConditionEvaluator
{
    /**
     * @param  array<string, int|float>|null  $condition
     * @return array{passes: bool, explanation: string|null}
     */
    public function evaluate(?array $condition, EmployeeRequest $request): array
    {
        if ($condition === null || $condition === []) {
            return ['passes' => true, 'explanation' => null];
        }

        $explanations = [];
        $passes = true;

        foreach ($condition as $key => $threshold) {
            $parsed = self::parseKey($key);

            if ($parsed === null) {
                continue;
            }

            [$metric, $operator] = $parsed;
            $actual = $this->measure($metric, $request);
            $holds = $operator->holds($actual, (float) $threshold);
            $passes = $passes && $holds;
            $explanations[] = self::explain($metric, $operator, $actual, (float) $threshold, $holds);
        }

        return ['passes' => $passes, 'explanation' => $explanations === [] ? null : implode('; ', $explanations)];
    }

    /**
     * @return array{0: ConditionMetric, 1: ConditionOperator}|null
     */
    public static function parseKey(string $key): ?array
    {
        if (preg_match('/^(.+)_(gt|gte|lt|lte)$/', $key, $matches) !== 1) {
            return null;
        }

        $metric = ConditionMetric::tryFrom($matches[1]);

        return $metric === null ? null : [$metric, ConditionOperator::from($matches[2])];
    }

    public function measure(ConditionMetric $metric, EmployeeRequest $request): float
    {
        return match ($metric) {
            ConditionMetric::Days => (float) ($request->days ?? 0),
            ConditionMetric::Minutes => (float) ($request->minutes ?? 0),
            ConditionMetric::OvertimeMonthMinutes => $this->overtimeMonthMinutes($request),
        };
    }

    /**
     * Overtime minutes of the requester in the request's office month: other
     * pending/approved overtime plus this request.
     */
    public function overtimeMonthMinutes(EmployeeRequest $request): float
    {
        $local = OfficeTime::local($request->start_at);
        $from = OfficeTime::startOfDay($local->startOfMonth()->toDateString());
        $to = OfficeTime::startOfDay($local->startOfMonth()->addMonth()->toDateString());

        $others = (int) EmployeeRequest::query()
            ->where('user_id', $request->user_id)
            ->when($request->exists, fn (Builder $query) => $query->whereKeyNot($request->id))
            ->whereIn('status', RequestStatus::values([RequestStatus::Pending, RequestStatus::Approved]))
            ->where('start_at', '>=', $from)
            ->where('start_at', '<', $to)
            ->whereHas('leaveType', fn (Builder $type) => $type->where('category', RequestCategory::Overtime->value))
            ->sum('minutes');

        return (float) ($others + ($request->minutes ?? 0));
    }

    private static function explain(ConditionMetric $metric, ConditionOperator $operator, float $actual, float $threshold, bool $holds): string
    {
        $format = fn (float $value): string => $metric === ConditionMetric::Days
            ? BalanceLedger::format($value).' hari'
            : BalanceLedger::format(round($value / 60, 1)).' jam';

        return $holds
            ? sprintf('%s %s %s', $format($actual), $operator->symbol(), $format($threshold))
            : sprintf('%s, %s %s', $format($actual), $operator->failurePhrase(), $format($threshold));
    }
}
