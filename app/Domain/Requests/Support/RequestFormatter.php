<?php

namespace App\Domain\Requests\Support;

use App\Domain\Requests\Enums\RequestCategory;
use App\Domain\Requests\Services\BalanceLedger;
use App\Models\EmployeeRequest;
use Carbon\CarbonImmutable;

/**
 * Indonesian one-line texts for notifications and emails (the UI formats on the client).
 */
final class RequestFormatter
{
    private const array MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    public static function summary(EmployeeRequest $request): string
    {
        $duration = self::duration($request);

        return self::period($request).($duration === null ? '' : ' · '.$duration);
    }

    /**
     * "12–14 Okt 2026", "18 Sep 2026 · 14.00–16.00", "2 Okt 2026 · masuk 08.00 · pulang 17.10".
     */
    public static function period(EmployeeRequest $request): string
    {
        $start = OfficeTime::local($request->start_at);
        $end = OfficeTime::local($request->end_at);

        if ($request->leaveType->category === RequestCategory::Correction) {
            $parts = [self::day($start)];

            foreach (['check_in' => 'masuk', 'check_out' => 'pulang'] as $key => $label) {
                $time = $request->payload[$key] ?? null;

                if (is_string($time) && $time !== '') {
                    $parts[] = $label.' '.str_replace(':', '.', $time);
                }
            }

            return implode(' · ', $parts);
        }

        if ($request->minutes !== null) {
            return self::day($start).' · '.$start->format('H.i').'–'.$end->format('H.i');
        }

        if ($start->isSameDay($end)) {
            return self::day($start);
        }

        if ($start->isSameMonth($end)) {
            return $start->day.'–'.self::day($end);
        }

        if ($start->year === $end->year) {
            return $start->day.' '.self::month($start).' – '.self::day($end);
        }

        return self::day($start).' – '.self::day($end);
    }

    public static function duration(EmployeeRequest $request): ?string
    {
        if ($request->minutes !== null) {
            return BalanceLedger::format(round($request->minutes / 60, 1)).' jam';
        }

        if ($request->days !== null) {
            return BalanceLedger::format($request->days).' '.$request->leaveType->dayUnit();
        }

        return null;
    }

    private static function day(CarbonImmutable $date): string
    {
        return $date->day.' '.self::month($date).' '.$date->year;
    }

    private static function month(CarbonImmutable $date): string
    {
        return self::MONTHS[$date->month - 1];
    }
}
