<?php

namespace App\Domain\Meetings\Queries;

use App\Domain\Attendance\Enums\HolidayType;
use App\Domain\Attendance\Models\Holiday;
use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Organization\Enums\Role;
use App\Domain\Requests\Enums\RequestCategory;
use App\Domain\Requests\Enums\RequestStatus;
use App\Models\EmployeeRequest;
use App\Models\Meeting;
use App\Models\Task;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;

/**
 * /kalender: one personal calendar in layers for the weeks covering a month
 * (Monday before the 1st … Sunday after the last day):
 * - meetings the viewer can see (series expanded), canceled ones left out;
 * - open tasks assigned to the viewer with a due date (visible workspaces);
 * - approved leave, permits, sick days and business trips of the viewer —
 *   for a Kepala Divisi also of their division's employees;
 * - company holidays.
 * Shaped like CalendarEntry in resources/js/features/meetings/types.ts.
 */
final class CalendarFeed
{
    public function __construct(private readonly MeetingFeed $feed) {}

    /**
     * @return array{from: string, to: string, entries: list<array<string, mixed>>}
     */
    public function forMonth(User $viewer, int $year, int $month): array
    {
        $timezone = config()->string('app.office_timezone');
        $first = CarbonImmutable::create($year, $month, 1, 0, 0, 0, $timezone) ?? CarbonImmutable::now($timezone)->startOfMonth();
        $from = $first->startOfWeek(CarbonImmutable::MONDAY);
        $to = $first->endOfMonth()->endOfWeek(CarbonImmutable::SUNDAY)->addDay()->startOfDay();
        $today = CarbonImmutable::now($timezone)->toDateString();

        $entries = [
            ...$this->meetings($viewer, $from, $to),
            ...$this->tasks($viewer, $from, $to, $today),
            ...$this->leave($viewer, $from, $to),
            ...$this->holidays($viewer, $from, $to),
        ];

        return [
            'from' => $from->toDateString(),
            'to' => $to->subDay()->toDateString(),
            'entries' => $entries,
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function meetings(User $viewer, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $timezone = config()->string('app.office_timezone');

        return array_values($this->feed->occurrences(Meeting::query()->visibleTo($viewer)->active(), $from->utc(), $to->utc())
            ->map(fn (Occurrence $occurrence): array => [
                'id' => 'meeting-'.$occurrence->key(),
                'layer' => 'meetings',
                'date' => $occurrence->date,
                'title' => $occurrence->meeting->title,
                'starts_at' => $occurrence->startsAt->toIso8601ZuluString(),
                'ends_at' => $occurrence->endsAt->toIso8601ZuluString(),
                'meta' => $occurrence->startsAt->setTimezone($timezone)->format('H.i').'–'.$occurrence->endsAt->setTimezone($timezone)->format('H.i')
                    .' · '.$occurrence->meeting->platform->label(),
                'href' => $occurrence->url(),
            ])
            ->all());
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function tasks(User $viewer, CarbonImmutable $from, CarbonImmutable $to, string $today): array
    {
        return array_values(Task::query()
            ->visibleTo($viewer)
            ->open()
            ->whereNull('tasks.parent_id')
            ->whereHas('assignees', fn (Builder $assignee) => $assignee->where('users.id', $viewer->id))
            ->whereDate('tasks.due_date', '>=', $from->toDateString())
            ->whereDate('tasks.due_date', '<', $to->toDateString())
            ->with('workspace:id,key')
            ->orderBy('tasks.due_date')
            ->limit(300)
            ->get(['tasks.id', 'tasks.workspace_id', 'tasks.number', 'tasks.title', 'tasks.due_date'])
            ->map(function (Task $task) use ($today): array {
                $due = $task->due_date?->toDateString() ?? $today;

                return [
                    'id' => 'task-'.$task->id,
                    'layer' => 'tasks',
                    'date' => $due,
                    'title' => $task->displayKey().' · '.$task->title,
                    'meta' => $due < $today ? 'Terlambat' : 'Tenggat',
                    'href' => $task->url(),
                    'overdue' => $due < $today,
                ];
            })
            ->all());
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function leave(User $viewer, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $timezone = config()->string('app.office_timezone');
        $divisionIds = $viewer->hasRole(Role::KepalaDivisi) ? $viewer->ledDivisionIds() : [];

        return array_values(EmployeeRequest::query()
            ->where('status', RequestStatus::Approved->value)
            ->where(fn (Builder $who) => $who->where('user_id', $viewer->id)
                ->when($divisionIds !== [], fn (Builder $division) => $division->orWhereIn('user_id', User::query()
                    ->where('company_id', $viewer->company_id)
                    ->whereIn('division_id', $divisionIds)
                    ->select('id'))))
            ->whereHas('leaveType', fn (Builder $type) => $type->whereIn('category', [
                RequestCategory::Leave->value, RequestCategory::Permit->value, RequestCategory::Sick->value, RequestCategory::BusinessTrip->value,
            ]))
            ->where('start_at', '<', $to->utc())
            ->where('end_at', '>=', $from->utc())
            ->with(['user:id,name', 'leaveType:id,name,category'])
            ->orderBy('start_at')
            ->limit(300)
            ->get()
            ->map(function (EmployeeRequest $request) use ($timezone): array {
                $start = CarbonImmutable::instance($request->start_at)->setTimezone($timezone)->toDateString();
                $end = CarbonImmutable::instance($request->end_at)->setTimezone($timezone)->toDateString();
                $name = explode(' ', $request->user->name)[0];

                return [
                    'id' => 'leave-'.$request->id,
                    'layer' => 'leave',
                    'date' => $start,
                    'end_date' => $end,
                    'title' => $name.' · '.$request->leaveType->name,
                    'meta' => $start === $end ? self::shortDate($start) : self::shortDate($start).' – '.self::shortDate($end),
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
            ->get()
            ->map(fn (Holiday $holiday): array => [
                'id' => 'holiday-'.$holiday->id,
                'layer' => 'holidays',
                'date' => $holiday->date->toDateString(),
                'title' => $holiday->name,
                'meta' => match ($holiday->type) {
                    HolidayType::National => 'Libur nasional',
                    HolidayType::CollectiveLeave => 'Cuti bersama',
                    HolidayType::Company => 'Libur kantor',
                },
            ])
            ->all());
    }

    /** "Sen, 5 Okt". */
    private static function shortDate(string $date): string
    {
        $value = CarbonImmutable::parse($date);
        $days = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
        $months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

        return $days[$value->dayOfWeekIso - 1].', '.$value->day.' '.$months[$value->month - 1];
    }
}
