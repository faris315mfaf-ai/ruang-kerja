<?php

namespace App\Http\Resources\Attendance;

use App\Domain\Attendance\Data\DaySchedule;
use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Enums\LogFlag;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\AttendanceLog;
use App\Domain\Attendance\Models\OfficeLocation;
use App\Domain\Attendance\Services\ScheduleResolver;
use App\Domain\Organization\Enums\Permission;
use App\Http\Resources\Attendance\Concerns\NamesPeople;
use App\Models\Division;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Gate;

/**
 * HR › Absensi hari ini (mockups DashboardHR / MDashboardHR): who is present,
 * late, on leave or not checked in yet, per division; flagged logs waiting for
 * review; yesterday's missing check-outs. Scope: AttendanceDay::visibleTo().
 */
final class TodayBoard
{
    use NamesPeople;

    /** Person states on the board. */
    public const array STATES = ['on_time', 'late', 'leave', 'not_checked_in', 'off'];

    public const int SUSPICIOUS_LIMIT = 20;

    public function __construct(private readonly ScheduleResolver $schedules) {}

    /**
     * @return array<string, mixed>
     */
    public function build(User $viewer, CarbonImmutable $now, ?string $locationId = null): array
    {
        $today = ScheduleResolver::officeDate($now);
        $people = $this->people($viewer, $today, $locationId);
        $scheduled = $people->where('scheduled', true);
        $present = $people->whereIn('state', ['on_time', 'late']);
        $leave = $people->where('state', 'leave');

        return [
            'date' => $today->toDateString(),
            'generatedAt' => AttendancePresenter::iso($now),
            'summary' => [
                'scheduled' => $scheduled->count(),
                'shifts' => $scheduled->groupBy('shiftName')
                    ->map(fn (Collection $group, string $name): array => ['name' => $name, 'count' => $group->count()])
                    ->sortByDesc('count')->values()->all(),
                'present' => $present->count(),
                'late' => $people->where('state', 'late')->count(),
                'onLeave' => $leave->count(),
                'leaveBreakdown' => collect([AttendanceStatus::Leave, AttendanceStatus::Permit, AttendanceStatus::Sick, AttendanceStatus::BusinessTrip])
                    ->map(fn (AttendanceStatus $status): array => ['status' => $status->value, 'label' => $status->label(), 'count' => $leave->where('status', $status->value)->count()])
                    ->filter(fn (array $item): bool => $item['count'] > 0)->values()->all(),
                'notCheckedIn' => $people->where('state', 'not_checked_in')->count(),
            ],
            'divisions' => $this->divisions($people),
            'people' => $people->values()->all(),
        ];
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function people(User $viewer, CarbonImmutable $today, ?string $locationId): Collection
    {
        $users = User::query()
            ->whereIn('users.id', AttendanceDay::visibleUserIds($viewer))
            ->active()
            ->with('division:id,name')
            ->orderBy('name')
            ->get();

        $schedules = $this->schedules->forRange($users, $today, $today);
        $days = AttendanceDay::query()
            ->with(['shift', 'checkInLog.officeLocation'])
            ->whereIn('user_id', $users->pluck('id'))
            ->whereDate('work_date', $today->toDateString())
            ->get()
            ->keyBy('user_id');
        $locations = OfficeLocation::withTrashed()->where('company_id', $viewer->company_id)->pluck('name', 'id');

        return $users
            ->map(fn (User $user): array => $this->person($user, $schedules[$user->id][$today->toDateString()] ?? null, $days->get($user->id), $locations))
            ->filter(fn (array $person): bool => $person['state'] !== 'off' || $person['checkInAt'] !== null)
            ->filter(fn (array $person): bool => $locationId === null || $person['locationId'] === $locationId)
            ->values();
    }

    /**
     * @param  Collection<string, string>  $locations  id => name
     * @return array<string, mixed>
     */
    private function person(User $user, ?DaySchedule $schedule, ?AttendanceDay $day, Collection $locations): array
    {
        $state = self::state($schedule, $day);
        $locationId = $day?->checkInLog->office_location_id ?? $schedule?->shift?->office_location_id;

        return [
            'id' => $user->id,
            'name' => $user->name,
            'initials' => self::initials($user->name),
            'divisionId' => $user->division_id,
            'divisionName' => $user->division->name ?? 'Tanpa divisi',
            'locationId' => $locationId,
            'locationName' => $locationId === null ? null : $locations->get($locationId),
            'shiftName' => $day?->shift->name ?? $schedule?->shift->name ?? 'Tanpa shift',
            'scheduled' => ($schedule?->isWorkday() ?? false) || $state === 'leave',
            'state' => $state,
            'status' => $day?->status->value,
            'statusLabel' => $day?->status->label(),
            'checkInAt' => AttendancePresenter::iso($day?->check_in_at),
            'checkOutAt' => AttendancePresenter::iso($day?->check_out_at),
            'lateMinutes' => $day->late_minutes ?? 0,
            'method' => $day?->checkInLog?->method->value,
            'isSuspicious' => $day->is_suspicious ?? false,
        ];
    }

    private static function state(?DaySchedule $schedule, ?AttendanceDay $day): string
    {
        return match (true) {
            // A half-day leave or business trip with a check-in counts as present.
            $day !== null && $day->status->comesFromRequest() && $day->check_in_at === null => 'leave',
            $day?->check_in_at !== null => $day->late_minutes > 0 ? 'late' : 'on_time',
            $schedule?->isWorkday() ?? false => 'not_checked_in',
            default => 'off',
        };
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $people
     * @return list<array<string, mixed>>
     */
    private function divisions(Collection $people): array
    {
        return array_values($people
            ->groupBy(fn (array $person): string => (string) ($person['divisionId'] ?? ''))
            ->map(fn (Collection $group): array => [
                'id' => $group->first()['divisionId'] ?? null,
                'name' => $group->first()['divisionName'] ?? 'Tanpa divisi',
                'scheduled' => $group->where('scheduled', true)->count(),
                'onTime' => $group->where('state', 'on_time')->count(),
                'late' => $group->where('state', 'late')->count(),
                'onLeave' => $group->where('state', 'leave')->count(),
                'notCheckedIn' => $group->where('state', 'not_checked_in')->count(),
            ])
            ->sortBy('name')
            ->all());
    }

    /**
     * Flagged logs nobody reviewed yet, newest first.
     *
     * @return array{total: int, items: list<array<string, mixed>>}
     */
    public function suspicious(User $viewer): array
    {
        $query = AttendanceLog::query()
            ->visibleTo($viewer)
            ->where('is_suspicious', true)
            ->whereNull('reviewed_at');

        $logs = (clone $query)
            ->with(['user.division:id,name', 'officeLocation', 'day.shift.officeLocation'])
            ->orderByDesc('occurred_at')
            ->limit(self::SUSPICIOUS_LIMIT)
            ->get();

        return [
            'total' => $query->count(),
            'items' => array_values($logs->map(fn (AttendanceLog $log): array => [
                'id' => $log->id,
                'userId' => $log->user_id,
                'name' => $log->user->name,
                'initials' => self::initials($log->user->name),
                'divisionName' => $log->user->division?->name,
                'type' => $log->type->value,
                'typeLabel' => $log->type->label(),
                'method' => $log->method->value,
                'methodLabel' => $log->method->label(),
                'occurredAt' => AttendancePresenter::iso($log->occurred_at),
                'clientTime' => AttendancePresenter::iso($log->client_time),
                'locationName' => $log->officeLocation->name ?? $log->day->shift?->officeLocation?->name,
                'radiusM' => $log->officeLocation->radius_m ?? $log->day->shift?->officeLocation?->radius_m,
                'accuracyM' => $log->accuracy_m === null ? null : (int) round($log->accuracy_m),
                'distanceM' => $log->distance_m === null ? null : (int) round($log->distance_m),
                'note' => $log->note,
                'flags' => $log->flags->map(fn (LogFlag $flag): array => ['value' => $flag->value, 'label' => $flag->label()])->values()->all(),
                'hasSelfie' => $log->selfie_path !== null,
                'canViewSelfie' => $log->selfie_path !== null && Gate::forUser($viewer)->allows('viewSelfie', $log),
                'canReview' => Gate::forUser($viewer)->allows('review', $log),
            ])->all()),
        ];
    }

    /**
     * Yesterday's days with a check-in but no check-out.
     *
     * @return list<array<string, mixed>>
     */
    public function missingCheckOut(User $viewer, CarbonImmutable $now): array
    {
        $yesterday = ScheduleResolver::officeDate($now)->subDay()->toDateString();

        return array_values(AttendanceDay::query()
            ->visibleTo($viewer)
            ->with(['user:id,name', 'shift.officeLocation', 'checkInLog.officeLocation'])
            ->whereDate('work_date', $yesterday)
            ->whereNotNull('check_in_at')
            ->whereNull('check_out_at')
            ->orderBy('check_in_at')
            ->get()
            ->map(fn (AttendanceDay $day): array => [
                'dayId' => $day->id,
                'userId' => $day->user_id,
                'name' => $day->user->name,
                'initials' => self::initials($day->user->name),
                'workDate' => $day->work_date->toDateString(),
                'shiftName' => $day->shift?->name,
                'locationName' => $day->checkInLog->officeLocation->name ?? $day->shift?->officeLocation?->name,
                'checkInAt' => AttendancePresenter::iso($day->check_in_at),
            ])
            ->all());
    }

    /**
     * Echo channels the viewer may listen on (routes/channels.php).
     *
     * @return array{company: bool, divisions: list<string>}
     */
    public static function channels(User $viewer): array
    {
        $all = $viewer->hasPermission(Permission::AttendanceViewAll);

        return [
            'company' => $all,
            'divisions' => $all ? [] : $viewer->ledDivisionIds(),
        ];
    }

    /**
     * @return list<array{id: string, name: string}>
     */
    public static function locationOptions(User $viewer): array
    {
        return array_values(OfficeLocation::query()->visibleTo($viewer)->active()->orderBy('name')->get(['id', 'name'])
            ->map(fn (OfficeLocation $location): array => ['id' => $location->id, 'name' => $location->name])->all());
    }

    /**
     * @return list<array{id: string, name: string}>
     */
    public static function divisionOptions(User $viewer): array
    {
        return array_values(Division::query()->visibleTo($viewer)->orderBy('name')->get(['id', 'name'])
            ->map(fn (Division $division): array => ['id' => $division->id, 'name' => $division->name])->all());
    }
}
