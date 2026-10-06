<?php

namespace App\Domain\Meetings\Queries;

use App\Http\Resources\Meetings\MeetingPresenter;
use App\Models\Meeting;
use App\Models\MeetingMinutes;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * /manajemen/jadwal (dashboard.view_company): leadership meetings of the
 * company from four weeks back to the end of the current office week, with
 * their minutes and follow-ups — the page derives the week grid, "Notulensi"
 * and "Tindak lanjut rapat pimpinan" from them.
 */
final class ManagementSchedule
{
    public const int WEEKS_BACK = 4;

    public function __construct(
        private readonly MeetingFeed $feed,
        private readonly MeetingPresenter $presenter,
    ) {}

    /**
     * @return array{week_start: string, meetings: list<array<string, mixed>>, minutes: list<array<string, mixed>>, people: list<array<string, mixed>>}
     */
    public function forUser(User $viewer, ?CarbonImmutable $now = null): array
    {
        $timezone = config()->string('app.office_timezone');
        $weekStart = ($now ?? CarbonImmutable::now())->setTimezone($timezone)->startOfWeek(CarbonImmutable::MONDAY)->startOfDay();
        $from = $weekStart->subWeeks(self::WEEKS_BACK);
        $to = $weekStart->addWeek();

        $occurrences = $this->feed->occurrences(
            Meeting::query()->visibleTo($viewer)->active()->where('meetings.leadership', true),
            $from->utc(),
            $to->utc(),
        );
        $minutes = $this->feed->minutesFor($occurrences);

        $records = [];

        foreach ($occurrences as $occurrence) {
            $record = $minutes[$occurrence->key()] ?? null;

            if ($record instanceof MeetingMinutes) {
                $records[] = $this->presenter->minutes($occurrence, $record);
            }
        }

        return [
            'week_start' => $weekStart->toDateString(),
            'meetings' => $this->feed->present($occurrences, $minutes),
            'minutes' => $records,
            'people' => $this->feed->people($occurrences, $minutes, [$viewer->id]),
        ];
    }
}
