<?php

namespace Database\Seeders;

use App\Domain\Analytics\Services\ScheduleSnapshot;
use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Models\Shift;
use App\Domain\Attendance\Models\ShiftAssignment;
use App\Domain\Organization\Demo\DemoCompany;
use App\Domain\Organization\Enums\Role;
use App\Domain\Organization\Enums\UserStatus;
use App\Domain\Organization\Enums\WorkMode;
use App\Domain\Tasks\Enums\TaskStatusCategory;
use App\Domain\Tasks\Services\DefaultTaskStatuses;
use App\Domain\Workspaces\Actions\EnsurePersonalWorkspace;
use App\Domain\Workspaces\Actions\SyncDivisionMembers;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Domain\Workspaces\Events\WorkspaceCreated;
use App\Domain\Workspaces\Events\WorkspaceMembersChanged;
use App\Models\Company;
use App\Models\Division;
use App\Models\Position;
use App\Models\TaskStatus;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;

/**
 * Local-only volume data for the dashboards (Sprint 9): tops the demo company
 * up to ~50 active employees and writes ~6 months of attendance days and
 * division tasks, so the "< 1 s with 50 employees × 6 months" criterion can
 * be measured. Idempotent: extra employees are keyed by email, attendance
 * days by (user, date) and tasks by the marker in `description_text`.
 *
 * Deterministic pseudo-random (crc32) so two runs give the same numbers.
 * Rows are bulk-inserted without activities, logs or notifications.
 */
class AnalyticsDemoSeeder extends Seeder
{
    public const string TASK_MARKER = 'Data demo analitik';

    /** Run outside APP_ENV=local only when set (tests use small sizes). */
    public bool $force = false;

    public int $targetEmployees = 50;

    public int $days = 182;

    /** Tasks per person per week. */
    public int $tasksPerWeek = 3;

    private const array FIRST = ['Adi', 'Bella', 'Citra', 'Dewi', 'Eko', 'Fajar', 'Gita', 'Hadi', 'Indra', 'Joko', 'Kartika', 'Lina', 'Made', 'Nur', 'Oka', 'Putri', 'Raka', 'Sinta', 'Tono', 'Umi', 'Vina', 'Wahyu', 'Yuni', 'Zaki', 'Ayu', 'Bayu', 'Cahya', 'Dian', 'Erna', 'Farhan', 'Galih', 'Hesti'];

    private const array LAST = ['Saputra', 'Lestari', 'Wijaya', 'Nugroho', 'Santoso', 'Hidayat', 'Permata', 'Kusuma', 'Pratiwi', 'Setiawan', 'Rahayu', 'Gunawan'];

    private const array TASKS = [
        'Rekap stok mingguan', 'Laporan penjualan', 'Verifikasi tagihan vendor', 'Perbarui SOP', 'Rapat koordinasi tim',
        'Analisis biaya operasional', 'Jadwal perawatan kendaraan', 'Konten media sosial', 'Rekonsiliasi kas', 'Evaluasi pemasok',
        'Pelatihan karyawan baru', 'Audit dokumen', 'Survei kepuasan pelanggan', 'Persiapan presentasi', 'Revisi anggaran',
    ];

    public function run(): void
    {
        if (! $this->force && ! app()->environment('local')) {
            return;
        }

        $company = DemoCompany::ensure();
        $today = CarbonImmutable::now(config()->string('app.office_timezone'))->startOfDay();
        $modelDispatcher = Model::getEventDispatcher();

        Event::fakeFor(function () use ($company, $today): void {
            Model::withoutEvents(function () use ($company, $today): void {
                $this->employees($company, $today);
                $people = User::query()->where('company_id', $company->id)->active()->orderBy('email')->get();
                $this->attendance($people, $today);
                $this->tasks($company, $people, $today);
            });
        }, [WorkspaceCreated::class, WorkspaceMembersChanged::class]);

        if ($modelDispatcher === null) {
            Model::unsetEventDispatcher();
        } else {
            Model::setEventDispatcher($modelDispatcher);
        }
    }

    /**
     * Extra staff spread over the non-board divisions, reporting to the head.
     */
    private function employees(Company $company, CarbonImmutable $today): void
    {
        $active = User::query()->where('company_id', $company->id)->active()->count();
        $missing = $this->targetEmployees - $active;
        $divisions = Division::query()->where('company_id', $company->id)->where('is_board', false)->orderBy('code')->get();

        if ($missing <= 0 || $divisions->isEmpty()) {
            return;
        }

        $position = Position::query()->where('company_id', $company->id)->orderByDesc('level')->first();
        $shift = Shift::query()->where('company_id', $company->id)->where('name', 'Reguler')->first()
            ?? Shift::query()->create(['company_id' => $company->id, 'name' => 'Reguler', 'start_time' => '08:00', 'end_time' => '17:00', 'break_minutes' => 60, 'late_tolerance_min' => 10, 'early_leave_tolerance_min' => 0, 'check_in_window_before_min' => 120]);

        for ($i = 1; $missing > 0 && $i <= 200; $i++) {
            $email = sprintf('analitik.%02d@demo.test', $i);

            if (User::query()->where('email', $email)->exists()) {
                continue;
            }

            $division = $divisions[$i % $divisions->count()];
            $user = User::query()->forceCreate([
                'company_id' => $company->id,
                'name' => self::FIRST[$i % count(self::FIRST)].' '.self::LAST[intdiv($i, count(self::FIRST)) % count(self::LAST)],
                'email' => $email,
                'division_id' => $division->id,
                'position_id' => $position?->id,
                'manager_id' => $division->head_user_id,
                'work_mode' => WorkMode::Office,
                'status' => UserStatus::Active,
                'joined_at' => $today->subMonths(8)->toDateString(),
                'email_verified_at' => now(),
            ]);
            $user->assignRole(Role::Anggota->value);
            app(EnsurePersonalWorkspace::class)->handle($user);
            ShiftAssignment::query()->create([
                'user_id' => $user->id,
                'shift_id' => $shift->id,
                'weekdays' => [1, 2, 3, 4, 5],
                'valid_from' => $today->subDays($this->days + 7)->toDateString(),
            ]);
            $missing--;
        }

        $divisions->each(fn (Division $division) => app(SyncDivisionMembers::class)->handle($division));
    }

    /**
     * One attendance day per scheduled work day in [today − days, today),
     * plus this morning for the extra staff; existing rows are kept.
     *
     * @param  Collection<int, User>  $people
     */
    private function attendance(Collection $people, CarbonImmutable $today): void
    {
        $existing = DB::table('attendance_days')
            ->whereIn('user_id', $people->modelKeys())
            ->where('work_date', '>=', $today->subDays($this->days)->toDateString())
            ->get(['user_id', 'work_date'])
            ->map(fn (object $row): string => $row->user_id.'|'.substr((string) $row->work_date, 0, 10))
            ->flip();
        $holidays = DB::table('holidays')->where('date', '>=', $today->subDays($this->days)->toDateString())->pluck('date')
            ->map(fn (mixed $date): string => substr((string) $date, 0, 10))->flip();
        $schedules = app(ScheduleSnapshot::class);
        $now = CarbonImmutable::now();
        $rows = [];

        for ($offset = $this->days; $offset >= 0; $offset--) {
            $date = $today->subDays($offset);
            $day = $date->toDateString();
            $shifts = $schedules->workShifts($people, $date);

            foreach ($people as $user) {
                $shift = $shifts[$user->id] ?? null;

                if ($shift === null || isset($existing[$user->id.'|'.$day]) || isset($holidays[$day])) {
                    continue;
                }

                // Today only for the extra staff (the regular demo keeps "today" for live check-ins).
                if ($offset === 0 && ! str_starts_with($user->email, 'analitik.')) {
                    continue;
                }

                $start = $shift->startOn($date)->utc();
                $end = $shift->endOn($date)->utc();

                if ($offset === 0 && $now->lt($start->subMinutes(30))) {
                    continue;
                }

                $roll = crc32($user->id.$day) % 100;
                [$status, $late] = match (true) {
                    $roll < 3 => [AttendanceStatus::Absent, 0],
                    $roll < 7 => [AttendanceStatus::Leave, 0],
                    $roll < 9 => [AttendanceStatus::Sick, 0],
                    $roll < 19 => [AttendanceStatus::Late, 3 + ($roll * 7) % 40],
                    $roll < 23 => [AttendanceStatus::Wfh, 0],
                    default => [AttendanceStatus::Present, 0],
                };

                if ($offset === 0 && in_array($status, [AttendanceStatus::Absent, AttendanceStatus::Leave, AttendanceStatus::Sick], true)) {
                    continue; // nobody is "alpha" before the day is closed
                }

                $attended = $status->isAttended();
                $checkIn = $attended ? $start->addMinutes($late > 0 ? $shift->late_tolerance_min + $late : -(($roll * 3) % 25)) : null;
                $checkOut = $attended && $offset > 0 ? $end->addMinutes(($roll * 5) % 40) : null;

                $rows[] = [
                    'id' => strtolower((string) Str::ulid()),
                    'user_id' => $user->id,
                    'work_date' => $day,
                    'shift_id' => $shift->id,
                    'scheduled_start' => $start,
                    'scheduled_end' => $end,
                    'check_in_at' => $checkIn,
                    'check_out_at' => $checkOut,
                    'status' => $status->value,
                    'late_minutes' => $late,
                    'early_leave_minutes' => 0,
                    'work_minutes' => $checkIn !== null && $checkOut !== null ? (int) $checkIn->diffInMinutes($checkOut) - $shift->break_minutes : 0,
                    'overtime_minutes' => 0,
                    'is_suspicious' => false,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
        }

        foreach (array_chunk($rows, 1000) as $chunk) {
            DB::table('attendance_days')->insert($chunk);
        }
    }

    /**
     * ~3 tasks per person per week in their division workspace: mostly done
     * (¾ on time), some late, the recent ones still open.
     *
     * @param  Collection<int, User>  $people
     */
    private function tasks(Company $company, Collection $people, CarbonImmutable $today): void
    {
        $workspaces = Workspace::query()
            ->where('company_id', $company->id)
            ->where('type', WorkspaceType::Division->value)
            ->get()
            ->keyBy('division_id');

        if ($workspaces->isEmpty() || DB::table('tasks')->whereIn('workspace_id', $workspaces->modelKeys())->where('description_text', self::TASK_MARKER)->exists()) {
            return;
        }

        $now = CarbonImmutable::now();
        $tz = config()->string('app.office_timezone');

        foreach ($workspaces as $divisionId => $workspace) {
            app(DefaultTaskStatuses::class)->ensure($workspace);
            /** @var array<string, TaskStatus> $statuses */
            $statuses = TaskStatus::query()->where('workspace_id', $workspace->id)->orderBy('position')->get()
                ->unique(fn (TaskStatus $status): string => $status->category->value)
                ->keyBy(fn (TaskStatus $status): string => $status->category->value)
                ->all();
            $members = $people->where('division_id', $divisionId)->values();

            if ($members->isEmpty() || ! isset($statuses['done'], $statuses['todo'], $statuses['in_progress'])) {
                continue;
            }

            $number = (int) DB::table('workspaces')->where('id', $workspace->id)->value('task_sequence');
            $tasks = [];
            $assignees = [];

            for ($week = intdiv($this->days, 7); $week >= 0; $week--) {
                foreach ($members as $member) {
                    for ($k = 0; $k < $this->tasksPerWeek; $k++) {
                        $roll = crc32($member->id.$week.$k) % 1000;
                        $created = $today->subWeeks($week)->startOfWeek()->addDays($roll % 5)->setTime(8 + $roll % 9, ($roll * 7) % 60, 0, 0);

                        if ($created->gt($now->setTimezone($tz))) {
                            continue;
                        }

                        $due = $created->addDays(2 + $roll % 9)->startOfDay();
                        // Old work is finished; a few recent tasks slipped past their due date.
                        $category = match (true) {
                            $due->lt($today->subDays(21)) => TaskStatusCategory::Done,
                            $due->lt($today->subDays(3)) => $roll % 12 === 0 ? TaskStatusCategory::Todo : TaskStatusCategory::Done,
                            $due->lt($today) => $roll % 4 === 0 ? TaskStatusCategory::InProgress : TaskStatusCategory::Done,
                            default => [TaskStatusCategory::Todo, TaskStatusCategory::InProgress, TaskStatusCategory::Done][$roll % 3],
                        };
                        $completed = null;

                        if ($category === TaskStatusCategory::Done) {
                            // ~75% on or before the due date, the rest 1–4 days late.
                            $completed = $roll % 4 === 0
                                ? $due->addDays(1 + $roll % 4)->setTime(10 + $roll % 6, 0)
                                : $due->subDays($roll % 3)->setTime(9 + $roll % 8, 30);
                            $completed = $completed->lt($created) ? $created->addHours(4) : $completed;
                            $completed = $completed->gt($now->setTimezone($tz)) ? $now->setTimezone($tz)->subHour() : $completed;
                        }

                        $number++;
                        $id = strtolower((string) Str::ulid());
                        $tasks[] = [
                            'id' => $id,
                            'workspace_id' => $workspace->id,
                            'number' => $number,
                            'title' => self::TASKS[$roll % count(self::TASKS)].' #'.$number,
                            'description_text' => self::TASK_MARKER,
                            'status_id' => $statuses[$category->value]->id,
                            'status_category' => $category->value,
                            'priority' => $roll % 5,
                            'position' => 'V'.str_pad((string) $number, 7, '0', STR_PAD_LEFT),
                            'due_date' => $due->toDateString(),
                            'estimate_hours' => $roll % 3 === 0 ? null : 1 + $roll % 8,
                            'created_by' => $member->id,
                            'started_at' => $category === TaskStatusCategory::Todo ? null : $created->addHours(2)->utc(),
                            'completed_at' => $completed?->utc(),
                            'created_at' => $created->utc(),
                            'updated_at' => ($completed ?? $created)->utc(),
                        ];
                        $assignees[] = ['task_id' => $id, 'user_id' => $member->id, 'assigned_at' => $created->utc()];
                    }
                }
            }

            foreach (array_chunk($tasks, 500) as $chunk) {
                DB::table('tasks')->insert($chunk);
            }

            foreach (array_chunk($assignees, 1000) as $chunk) {
                DB::table('task_assignees')->insert($chunk);
            }

            DB::table('workspaces')->where('id', $workspace->id)->update(['task_sequence' => $number]);
        }
    }
}
