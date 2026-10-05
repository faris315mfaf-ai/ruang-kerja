<?php

namespace Tests\Support;

use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Enums\LogFlag;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\AttendanceLog;
use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Requests\Actions\SubmitRequest;
use App\Domain\Requests\Data\RequestInput;
use App\Domain\Requests\Support\OfficeTime;
use App\Domain\Tasks\Actions\CreateTask;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Http\Middleware\HandleInertiaRequests;
use App\Models\AuditLog;
use App\Models\DriveFile;
use App\Models\InboxNotification;
use App\Models\LeaveType;
use App\Models\Milestone;
use App\Models\ProjectRisk;
use App\Models\ProjectUpdate;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Database\Seeders\AnalyticsDemoSeeder;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

/**
 * Query-count regression tests (Sprint 10): the demo data set, a way to
 * measure how many SQL queries a page needs (initial visit + every deferred
 * prop), and a way to multiply the rows each page lists. A page whose query
 * count grows with the data has an N+1.
 */
final class PerformanceFixtures
{
    public static function seed(): void
    {
        test()->seed(DatabaseSeeder::class);
    }

    public static function user(string $who): User
    {
        // Fresh instance per request, as in production (no relations carried over).
        return User::query()->where('email', "{$who}@demo.test")->firstOrFail();
    }

    /**
     * Queries for one page: the Inertia visit plus one reload of all its
     * deferred props (what the browser does right after).
     */
    public static function queries(string $who, string $url): int
    {
        // Cold caches (dashboard metric cache): measure the real work every time.
        Cache::flush();
        DB::flushQueryLog();
        DB::enableQueryLog();

        $response = test()->actingAs(self::user($who))->get($url);
        $response->assertSuccessful();
        $count = count(DB::getQueryLog());
        $page = $response->baseResponse->headers->get('content-type') === 'application/json' ? null : $response->viewData('page');
        $deferred = is_array($page) ? ($page['deferredProps'] ?? []) : [];

        if ($deferred !== []) {
            DB::flushQueryLog();
            test()->actingAs(self::user($who))->get($url, [
                'X-Inertia' => 'true',
                'X-Inertia-Version' => (string) app(HandleInertiaRequests::class)->version(request()),
                'X-Inertia-Partial-Component' => $page['component'],
                'X-Inertia-Partial-Data' => implode(',', array_merge(...array_values($deferred))),
            ])->assertSuccessful();
            $count += count(DB::getQueryLog());
        }

        DB::disableQueryLog();

        return $count;
    }

    /**
     * Multiplies what the main pages list: ~40 more employees with 3 weeks of
     * attendance and division tasks (AnalyticsDemoSeeder), pending requests for
     * the Kepala Divisi and HR, own requests, tasks with assignees and labels,
     * notifications, flagged check-ins, files, teams, workspaces, audit
     * entries and project milestones/risks/updates.
     */
    public static function grow(int $round = 1): void
    {
        $seeder = new AnalyticsDemoSeeder;
        $seeder->force = true;
        $seeder->targetEmployees = 30 + 15 * $round;
        $seeder->days = 21;
        $seeder->tasksPerWeek = 2;
        $seeder->setContainer(app())->__invoke();

        $kadiv = self::user('kadiv');
        $hr = self::user('hr');
        $anggota = self::user('anggota');
        $ops = Workspace::query()->where('key', 'OPS')->firstOrFail();
        $project = Workspace::query()->where('type', 'project')->orderBy('key')->firstOrFail();
        $team = User::query()->where('manager_id', $kadiv->id)->whereKeyNot($anggota->id)->orderBy('email')->limit(12)->offset(12 * ($round - 1))->get();
        $today = OfficeTime::today();
        $types = LeaveType::query()->get()->keyBy('code');

        Notification::fake();

        // Pending requests waiting for the Kepala Divisi (and HR after step 1).
        foreach ($team as $index => $member) {
            $start = $today->addWeeks(3 * $round)->addDays($index % 5)->next(CarbonImmutable::MONDAY);
            app(SubmitRequest::class)->handle($member, RequestInput::fromArray($types['IZN'], [
                'start_date' => $start->toDateString(),
                'end_date' => $start->toDateString(),
                'reason' => 'Urusan keluarga '.$index,
            ]));
        }

        // Own requests for the member's "Pengajuan saya".
        foreach (range(1, 6) as $week) {
            $start = $today->addWeeks(10 * $round + $week)->next(CarbonImmutable::TUESDAY);
            app(SubmitRequest::class)->handle($anggota, RequestInput::fromArray($types['IZN'], [
                'start_date' => $start->toDateString(),
                'end_date' => $start->toDateString(),
                'reason' => 'Keperluan pribadi '.$week,
            ]));
        }

        // Board tasks with assignees and labels.
        $labels = $ops->labels()->pluck('id')->all();
        $members = $ops->members()->pluck('users.id')->all();

        foreach (range(1, 15) as $i) {
            app(CreateTask::class)->handle($ops, $kadiv, [
                'title' => "Tugas volume {$round}.{$i}",
                'assignee_ids' => array_slice($members, $i % max(1, count($members)), 2),
                'label_ids' => array_slice($labels, 0, 2),
                'due_date' => $today->addDays($i - 5)->toDateString(),
            ]);
        }

        foreach ([$anggota, $hr, $kadiv] as $recipient) {
            InboxNotification::factory()->count(8)->recipient($recipient)->ofType(NotificationType::RequestSubmitted)->create();
            InboxNotification::factory()->count(4)->recipient($recipient)->create();
        }

        // Flagged check-ins today and forgotten check-outs yesterday (HR review lists).
        foreach ($team->take(8) as $member) {
            $day = AttendanceDay::query()->firstOrCreate(
                ['user_id' => $member->id, 'work_date' => $today->toDateString()],
                ['status' => AttendanceStatus::Present, 'check_in_at' => now()->subHour()],
            );
            AttendanceLog::factory()->forDay($day)->create(['is_suspicious' => true, 'flags' => [LogFlag::LowAccuracy], 'occurred_at' => now()->subHour()]);
            AttendanceDay::query()->updateOrCreate(
                ['user_id' => $member->id, 'work_date' => $today->subDay()->toDateString()],
                ['status' => AttendanceStatus::Present, 'check_in_at' => now()->subDay(), 'check_out_at' => null],
            );
        }

        DriveFile::factory()->count(8)->create(['workspace_id' => $ops->id]);
        Team::factory()->count(4)->create(['division_id' => $kadiv->division_id]);
        AuditLog::factory()->count(25)->create(['user_id' => $hr->id]);

        foreach (range(1, 4) as $i) {
            Workspace::factory()->team()->withMember($kadiv, WorkspaceRole::Admin)->withMember($anggota)->create(['name' => "Tim volume {$round}.{$i}"]);
        }

        Milestone::factory()->count(5)->for($project, 'workspace')->create();
        ProjectRisk::factory()->count(5)->for($project, 'workspace')->create();
        ProjectUpdate::factory()->count(5)->for($project, 'workspace')->create(['author_id' => $kadiv->id]);
    }
}
