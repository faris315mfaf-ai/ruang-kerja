<?php

namespace App\Domain\HrHub\Queries;

use App\Domain\Attendance\Enums\HolidayType;
use App\Domain\Attendance\Models\Holiday;
use App\Domain\Hiring\Enums\CandidateStage;
use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Meetings\Queries\MeetingFeed;
use App\Domain\Requests\Enums\RequestCategory;
use App\Domain\Requests\Enums\RequestStatus;
use App\Domain\Tenancy\Support\CurrentCompany;
use App\Models\Candidate;
use App\Models\EmployeeRequest;
use App\Models\Meeting;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;

/**
 * Ruang HR › Jadwal (keputusan pemilik 20 Okt 2026): one company-wide HR
 * calendar — meetings the viewer can see (FEATURE_MEETINGS), planned
 * candidate interviews, approved leave / permits / sick days / business trips
 * of the whole company, and company holidays. Unlike /kalender (personal),
 * leave is not limited to the viewer's own division. Bounded: at most
 * LIMIT rows per layer.
 *
 * Event: {id, kind: meeting|interview|leave|holiday, date, end_date, time,
 * title, subtitle, href}; `time` is "HH.mm" office time or null (all day).
 */
final class HrCalendar
{
    public const int LIMIT = 300;

    public function __construct(private readonly MeetingFeed $feed) {}

    /**
     * @return array{month: string, from: string, to: string, today: string, days: array<string, list<array<string, mixed>>>, week: list<array<string, mixed>>}
     */
    public function forMonth(User $viewer, int $year, int $month, ?CarbonImmutable $now = null): array
    {
        $timezone = CurrentCompany::timezone();
        $now = ($now ?? CarbonImmutable::now())->setTimezone($timezone);
        $first = CarbonImmutable::create($year, $month, 1, 0, 0, 0, $timezone) ?? $now->startOfMonth();
        $from = $first->startOfWeek(CarbonImmutable::MONDAY);
        $to = $first->endOfMonth()->endOfWeek(CarbonImmutable::SUNDAY)->addDay()->startOfDay();

        $days = [];

        foreach ($this->events($viewer, $from, $to) as $event) {
            $day = CarbonImmutable::parse($event['date'], $timezone);
            $last = CarbonImmutable::parse($event['end_date'] ?? $event['date'], $timezone);

            // Multi-day leave shows on every day inside the visible weeks.
            for ($cursor = $day->max($from); $cursor->lte($last) && $cursor->lt($to); $cursor = $cursor->addDay()) {
                $days[$cursor->toDateString()][] = $event;
            }
        }

        ksort($days);
        $weekStart = $now->startOfWeek(CarbonImmutable::MONDAY)->startOfDay();

        return [
            'month' => $first->format('Y-m'),
            'from' => $from->toDateString(),
            'to' => $to->subDay()->toDateString(),
            'today' => $now->toDateString(),
            'days' => $days,
            'week' => $this->events($viewer, $weekStart, $weekStart->addWeek()),
        ];
    }

    /**
     * Today's agenda (Ruang HR › Ringkasan).
     *
     * @return list<array<string, mixed>>
     */
    public function day(User $viewer, CarbonImmutable $now): array
    {
        $start = $now->setTimezone(CurrentCompany::timezone())->startOfDay();

        return $this->events($viewer, $start, $start->addDay());
    }

    /**
     * Events overlapping [$from, $to) (office-time bounds), sorted by date,
     * then all-day first, then time.
     *
     * @return list<array<string, mixed>>
     */
    public function events(User $viewer, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $events = [
            ...$this->meetings($viewer, $from, $to),
            ...$this->interviews($viewer, $from, $to),
            ...$this->leave($viewer, $from, $to),
            ...$this->holidays($viewer, $from, $to),
        ];

        usort($events, fn (array $a, array $b): int => [$a['date'], $a['time'] ?? '', $a['title']] <=> [$b['date'], $b['time'] ?? '', $b['title']]);

        return $events;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function meetings(User $viewer, CarbonImmutable $from, CarbonImmutable $to): array
    {
        if (! config('features.meetings')) {
            return [];
        }

        $timezone = CurrentCompany::timezone();

        return array_values($this->feed->occurrences(Meeting::query()->visibleTo($viewer)->active(), $from->utc(), $to->utc())
            ->take(self::LIMIT)
            ->map(fn (Occurrence $occurrence): array => [
                'id' => 'meeting-'.$occurrence->key(),
                'kind' => 'meeting',
                'date' => $occurrence->date,
                'end_date' => null,
                'time' => $occurrence->startsAt->setTimezone($timezone)->format('H.i'),
                'title' => $occurrence->meeting->title,
                'subtitle' => $occurrence->startsAt->setTimezone($timezone)->format('H.i').'–'.$occurrence->endsAt->setTimezone($timezone)->format('H.i')
                    .' · '.$occurrence->meeting->platform->label(),
                'href' => $occurrence->url(),
            ])
            ->all());
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function interviews(User $viewer, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $timezone = CurrentCompany::timezone();

        return array_values(Candidate::query()
            ->visibleTo($viewer)
            ->whereIn('stage', array_map(fn (CandidateStage $stage): string => $stage->value, CandidateStage::open()))
            ->whereNotNull('interview_at')
            ->where('interview_at', '>=', $from->utc())
            ->where('interview_at', '<', $to->utc())
            ->with('hiringPosition:id,title')
            ->orderBy('interview_at')
            ->limit(self::LIMIT)
            ->get(['id', 'company_id', 'position_id', 'full_name', 'stage', 'interview_at', 'interview_location', 'deleted_at'])
            ->map(function (Candidate $candidate) use ($timezone): array {
                /** @var CarbonImmutable $at */
                $at = $candidate->interview_at;
                $local = $at->setTimezone($timezone);

                return [
                    'id' => 'interview-'.$candidate->id,
                    'kind' => 'interview',
                    'date' => $local->toDateString(),
                    'end_date' => null,
                    'time' => $local->format('H.i'),
                    'title' => 'Wawancara · '.$candidate->full_name,
                    'subtitle' => $candidate->hiringPosition->title.($candidate->interview_location !== null ? ' · '.$candidate->interview_location : ''),
                    'href' => '/hiring/kandidat/'.$candidate->id,
                ];
            })
            ->all());
    }

    /**
     * Approved leave, permits, sick days and business trips of the company.
     *
     * @return list<array<string, mixed>>
     */
    private function leave(User $viewer, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $timezone = CurrentCompany::timezone();

        return array_values(EmployeeRequest::query()
            ->where('requests.company_id', $viewer->company_id)
            ->where('status', RequestStatus::Approved->value)
            ->whereHas('leaveType', fn (Builder $type) => $type->whereIn('category', [
                RequestCategory::Leave->value, RequestCategory::Permit->value, RequestCategory::Sick->value, RequestCategory::BusinessTrip->value,
            ]))
            ->where('start_at', '<', $to->utc())
            ->where('end_at', '>=', $from->utc())
            ->with(['user:id,name', 'leaveType:id,name,category'])
            ->orderBy('start_at')
            ->limit(self::LIMIT)
            ->get()
            ->map(function (EmployeeRequest $request) use ($timezone): array {
                $start = CarbonImmutable::instance($request->start_at)->setTimezone($timezone);
                $end = CarbonImmutable::instance($request->end_at)->setTimezone($timezone);
                $sameDay = $start->toDateString() === $end->toDateString();
                // Hourly permits carry a time; leave days are all-day.
                $timed = $request->minutes !== null && $sameDay;

                return [
                    'id' => 'leave-'.$request->id,
                    'kind' => 'leave',
                    'date' => $start->toDateString(),
                    'end_date' => $sameDay ? null : $end->toDateString(),
                    'time' => $timed ? $start->format('H.i') : null,
                    'title' => $request->user->name.' · '.$request->leaveType->name,
                    'subtitle' => $sameDay
                        ? ($timed ? $start->format('H.i').'–'.$end->format('H.i') : 'Sehari penuh')
                        : $start->format('d/m').' – '.$end->format('d/m'),
                    'href' => '/persetujuan/'.$request->id,
                ];
            })
            ->all());
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function holidays(User $viewer, CarbonImmutable $from, CarbonImmutable $to): array
    {
        return array_values(Holiday::query()
            ->where('company_id', $viewer->company_id)
            ->whereDate('date', '>=', $from->toDateString())
            ->whereDate('date', '<', $to->toDateString())
            ->orderBy('date')
            ->limit(self::LIMIT)
            ->get()
            ->map(fn (Holiday $holiday): array => [
                'id' => 'holiday-'.$holiday->id,
                'kind' => 'holiday',
                'date' => $holiday->date->toDateString(),
                'end_date' => null,
                'time' => null,
                'title' => $holiday->name,
                'subtitle' => match ($holiday->type) {
                    HolidayType::National => 'Libur nasional',
                    HolidayType::CollectiveLeave => 'Cuti bersama',
                    HolidayType::Company => 'Libur kantor',
                },
                'href' => null,
            ])
            ->all());
    }
}
