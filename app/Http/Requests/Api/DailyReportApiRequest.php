<?php

namespace App\Http\Requests\Api;

use App\Domain\Reports\Support\ReportDay;
use App\Http\Requests\Reports\SaveDailyReportRequest;

/**
 * Daily report form of the Android app (autosave and "Kirim"): the web rules
 * and messages (SaveDailyReportRequest). `report_date` is optional — absent
 * means today's office date; the app should send the date it opened the form
 * for, so a save that arrives after 23.59 is refused (`laporan_terkunci`)
 * instead of landing silently in the next day's report. `items` stays
 * required (`present`): items are replaced as a whole, so an autosave without
 * them must not wipe the rows.
 */
class DailyReportApiRequest extends SaveDailyReportRequest
{
    protected function prepareForValidation(): void
    {
        $date = $this->input('report_date');

        if (! is_string($date) || trim($date) === '') {
            $this->merge(['report_date' => ReportDay::today()]);
        }
    }
}
