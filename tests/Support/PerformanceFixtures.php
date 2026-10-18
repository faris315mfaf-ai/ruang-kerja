<?php

namespace Tests\Support;

use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Enums\LogFlag;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\AttendanceLog;
use App\Domain\Chat\Actions\CreateChannel;
use App\Domain\Chat\Actions\OpenDirectConversation;
use App\Domain\Chat\Actions\PostMessage;
use App\Domain\Chat\Actions\ToggleMessageReaction;
use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Planner\Actions\PlanTask;
use App\Domain\Planner\Enums\PlanBucket;
use App\Domain\Requests\Actions\SubmitRequest;
use App\Domain\Requests\Data\RequestInput;
use App\Domain\Requests\Support\OfficeTime;
use App\Domain\Tasks\Actions\CreateTask;
use App\Domain\Tenancy\CompanyContext;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Http\Middleware\HandleInertiaRequests;
use App\Models\AuditLog;
use App\Models\Candidate;
use App\Models\Channel;
use App\Models\Company;
use App\Models\DailyReport;
use App\Models\DailyReportItem;
use App\Models\DriveFile;
use App\Models\HiringPosition;
use App\Models\InboxNotification;
use App\Models\LeaveType;
use App\Models\Meeting;
use App\Models\Milestone;
use App\Models\Note;
use App\Models\ProjectRisk;
use App\Models\ProjectUpdate;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Database\Factories\CompanyFactory;
use Database\Seeders\AnalyticsDemoSeeder;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use RuntimeException;

/**
 * Query-count regression tests (Sprint 10): the demo data set, a way to
 * measure how many SQL queries a page needs (initial visit + every deferred
 * prop), and a way to multiply the rows each page lists. A page whose query
 * count grows with the data has an N+1.
 *
 * Two companies (Fase 1 multi-perusahaan): grow() also fills a second
 * company (foreignWorld(), every name carrying the marker ZZB0C0R) with the
 * same volume. A scope that misses company_id shows up as more queries or
 * more rows after grow(2), and every measured response is checked for the
 * marker.
 */
final class PerformanceFixtures
{
    /** Domain of the second company (tests/Support/tenancy-helpers.php). */
    public const string FOREIGN_DOMAIN = 'zzb0c0r.test';

    /** @var array<string, object> foreignWorld() per company id (a new database per test). */
    private static array $foreign = [];

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
        $content = (string) $response->getContent();

        if ($deferred !== []) {
            DB::flushQueryLog();
            $partial = test()->actingAs(self::user($who))->get($url, [
                'X-Inertia' => 'true',
                'X-Inertia-Version' => (string) app(HandleInertiaRequests::class)->version(request()),
                'X-Inertia-Partial-Component' => $page['component'],
                'X-Inertia-Partial-Data' => implode(',', array_merge(...array_values($deferred))),
            ])->assertSuccessful();
            $count += count(DB::getQueryLog());
            $content .= (string) $partial->getContent();
        }

        DB::disableQueryLog();
        self::assertNoForeignData($who, $url, $content);

        return $count;
    }

    /** The page of company A must not show anything of the second company. */
    private static function assertNoForeignData(string $who, string $url, string $content): void
    {
        $marker = self::marker();

        if (stripos($content, $marker) !== false) {
            $at = (int) stripos($content, $marker);

            test()->fail("{$who} {$url} shows data of the second company: …".substr($content, max(0, $at - 120), 240).'…');
        }
    }

    private static function marker(): string
    {
        require_once __DIR__.'/tenancy-helpers.php';

        return tenancyMarker();
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
        $ops = Workspace::query()->where('company_id', $kadiv->company_id)->where('key', 'OPS')->firstOrFail();
        $project = Workspace::query()->where('company_id', $kadiv->company_id)->where('type', 'project')->orderBy('key')->firstOrFail();
        $team = User::query()->where('manager_id', $kadiv->id)->whereKeyNot($anggota->id)->orderBy('email')->limit(12)->offset(12 * ($round - 1))->get();
        $today = OfficeTime::today();
        $types = LeaveType::query()->where('company_id', $kadiv->company_id)->get()->keyBy('code');

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

        // Ruang saya: planned personal notes and new assignments for the member.
        foreach ([$anggota, $kadiv] as $owner) {
            $personal = Workspace::query()->where('type', 'personal')->where('owner_id', $owner->id)->firstOrFail();

            foreach (range(1, 6) as $i) {
                $note = app(CreateTask::class)->handle($personal, $owner, ['title' => "Catatan {$round}.{$i}", 'assignee_ids' => [$owner->id]]);
                app(PlanTask::class)->handle($owner, $note, PlanBucket::cases()[$i % 3]);
            }
        }

        foreach (range(1, 4) as $i) {
            app(CreateTask::class)->handle($ops, $kadiv, [
                'title' => "Tugas baru {$round}.{$i}",
                'assignee_ids' => [$anggota->id],
                'due_date' => $today->addDays($i)->toDateString(),
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

        // Obrolan: more channels, DMs, threads, reactions and mentions for the Kepala Divisi.
        $post = app(PostMessage::class);
        $react = app(ToggleMessageReaction::class);

        foreach (range(1, 3) as $i) {
            $channel = app(CreateChannel::class)->handle($kadiv, ['name' => "volume {$round} {$i}", 'member_ids' => [$anggota->id, $hr->id]]);
            $dm = app(OpenDirectConversation::class)->handle($kadiv, [$team[$i]->id ?? $hr->id]);

            foreach ([$channel, $dm] as $conversation) {
                $root = $post->handle($conversation, $anggota->id === $kadiv->id ? $hr : $anggota, richDocument('Pesan volume '.$i));
                $post->handle($conversation, $kadiv, richDocument('Balasan '.$i), [], $root);
                $react->handle($root, $kadiv, '👍');
            }
        }

        $plqChannel = Channel::query()->where('type', 'workspace')->whereIn('workspace_id', Workspace::query()->where('company_id', $kadiv->company_id)->where('key', 'PLQ')->select('id'))->first();

        if ($plqChannel !== null) {
            foreach (range(1, 6) as $i) {
                $root = $post->handle($plqChannel, $kadiv, richDocument('Diskusi volume '.$round.'.'.$i));
                $post->handle($plqChannel, $kadiv, richDocument('Lanjutan '.$i), [], $root);
                $react->handle($root, $kadiv, '🎉');
            }
        }

        self::growForeign($round);
    }

    /** The second company: company B of foreignWorld(). */
    public static function foreignCompany(): Company
    {
        return Company::query()->where('google_domain', self::FOREIGN_DOMAIN)->firstOrFail();
    }

    /**
     * The same volume as grow() in the second company: employees with
     * attendance and division tasks (AnalyticsDemoSeeder), pending and own
     * requests, board tasks, planned personal tasks, notifications, flagged
     * check-ins, files, teams, audit entries, workspaces, project items, chat,
     * daily reports, meetings, notes and hiring candidates. Names carry the
     * marker, so a leak into a page of company A is found by queries().
     */
    public static function growForeign(int $round = 1): void
    {
        require_once __DIR__.'/tenancy-helpers.php';

        // Built by nobody: the user of the last measured page (company A)
        // would otherwise be the actor of B's audit entries.
        auth()->forgetGuards();

        $existing = Company::query()->where('google_domain', self::FOREIGN_DOMAIN)->first();
        $world = $existing === null ? foreignWorld() : (self::$foreign[$existing->id] ?? throw new RuntimeException('Perusahaan B dibuat di luar growForeign().'));
        self::$foreign[$world->company->id] = $world;
        $company = $world->company;
        $m = tenancyMarker();

        $seeder = new AnalyticsDemoSeeder;
        $seeder->force = true;
        $seeder->company = $company;
        $seeder->nameSuffix = " {$m}";
        $seeder->targetEmployees = 30 + 15 * $round;
        $seeder->days = 21;
        $seeder->tasksPerWeek = 2;
        $seeder->setContainer(app())->__invoke();

        Notification::fake();
        app(CompanyContext::class)->run($company, fn () => CompanyFactory::within($company, fn () => self::fillForeign($world, $round, $m)));
    }

    private static function fillForeign(object $world, int $round, string $m): void
    {
        $company = $world->company;
        $kadiv = $world->kadiv->fresh() ?? $world->kadiv;
        $hr = $world->hr->fresh() ?? $world->hr;
        $anggota = $world->anggota->fresh() ?? $world->anggota;
        $board = $world->teamWorkspace;
        $project = $world->projectWorkspace;
        $team = User::query()->where('company_id', $company->id)->where('manager_id', $kadiv->id)->whereKeyNot($anggota->id)
            ->orderBy('email')->limit(12)->offset(12 * ($round - 1))->get();
        $today = OfficeTime::today();
        $permit = LeaveType::query()->where('company_id', $company->id)->where('code', 'IZN')->firstOrFail();

        foreach ($team as $index => $member) {
            $start = $today->addWeeks(3 * $round)->addDays($index % 5)->next(CarbonImmutable::MONDAY);
            app(SubmitRequest::class)->handle($member, RequestInput::fromArray($permit, [
                'start_date' => $start->toDateString(),
                'end_date' => $start->toDateString(),
                'reason' => "Urusan keluarga {$m} {$index}",
            ]));
        }

        foreach (range(1, 6) as $week) {
            $start = $today->addWeeks(10 * $round + $week)->next(CarbonImmutable::TUESDAY);
            app(SubmitRequest::class)->handle($anggota, RequestInput::fromArray($permit, [
                'start_date' => $start->toDateString(),
                'end_date' => $start->toDateString(),
                'reason' => "Keperluan pribadi {$m} {$week}",
            ]));
        }

        $labels = $board->labels()->pluck('id')->all();
        $members = $board->members()->pluck('users.id')->all();

        foreach (range(1, 15) as $i) {
            app(CreateTask::class)->handle($board, $kadiv, [
                'title' => "Tugas volume {$m} {$round}.{$i}",
                'assignee_ids' => array_slice($members, $i % max(1, count($members)), 2),
                'label_ids' => array_slice($labels, 0, 2),
                'due_date' => $today->addDays($i - 5)->toDateString(),
            ]);
        }

        foreach ([$anggota, $kadiv] as $owner) {
            $personal = Workspace::query()->where('type', 'personal')->where('owner_id', $owner->id)->firstOrFail();

            foreach (range(1, 6) as $i) {
                $note = app(CreateTask::class)->handle($personal, $owner, ['title' => "Catatan {$m} {$round}.{$i}", 'assignee_ids' => [$owner->id]]);
                app(PlanTask::class)->handle($owner, $note, PlanBucket::cases()[$i % 3]);
            }
        }

        foreach ([$anggota, $hr, $kadiv] as $recipient) {
            InboxNotification::factory()->count(8)->recipient($recipient)->ofType(NotificationType::RequestSubmitted)
                ->withData(['title' => "Pengajuan {$m}", 'body' => "Isi {$m}", 'url' => '/persetujuan'])->create();
            InboxNotification::factory()->count(4)->recipient($recipient)->withData(['title' => "Notifikasi {$m}", 'body' => "Isi {$m}", 'url' => '/inbox'])->create();
        }

        foreach ($team->take(8) as $member) {
            $day = AttendanceDay::query()->firstOrCreate(
                ['user_id' => $member->id, 'work_date' => $today->toDateString()],
                ['status' => AttendanceStatus::Present, 'check_in_at' => now()->subHour()],
            );
            AttendanceLog::factory()->forDay($day)->create(['is_suspicious' => true, 'flags' => [LogFlag::LowAccuracy], 'occurred_at' => now()->subHour(), 'note' => "Log {$m}"]);
            AttendanceDay::query()->updateOrCreate(
                ['user_id' => $member->id, 'work_date' => $today->subDay()->toDateString()],
                ['status' => AttendanceStatus::Present, 'check_in_at' => now()->subDay(), 'check_out_at' => null],
            );
        }

        DriveFile::factory()->count(8)->sequence(fn ($sequence) => ['name' => "Berkas {$m} {$round}.{$sequence->index}"])->create(['workspace_id' => $board->id]);
        Team::factory()->count(4)->sequence(fn ($sequence) => ['name' => "Tim {$m} {$round}.{$sequence->index}"])->create(['division_id' => $kadiv->division_id]);
        AuditLog::factory()->count(25)->by($hr)->forSubject($anggota)->create(['action' => 'user.updated', 'new_values' => ['name' => "Audit {$m}"]]);

        foreach (range(1, 4) as $i) {
            Workspace::factory()->team()->withMember($kadiv, WorkspaceRole::Admin)->withMember($anggota)->create(['name' => "Tim volume {$m} {$round}.{$i}"]);
        }

        Milestone::factory()->count(5)->for($project, 'workspace')->create(['name' => "Milestone {$m}"]);
        ProjectRisk::factory()->count(5)->for($project, 'workspace')->create(['title' => "Risiko {$m}"]);
        ProjectUpdate::factory()->count(5)->for($project, 'workspace')->create(['author_id' => $kadiv->id, 'summary' => "Update {$m}"]);

        $post = app(PostMessage::class);
        $react = app(ToggleMessageReaction::class);

        foreach (range(1, 3) as $i) {
            $channel = app(CreateChannel::class)->handle($kadiv, ['name' => "volume {$m} {$round} {$i}", 'member_ids' => [$anggota->id, $hr->id]]);
            $dm = app(OpenDirectConversation::class)->handle($kadiv, [$team[$i]->id ?? $hr->id]);

            foreach ([$channel, $dm] as $conversation) {
                $root = $post->handle($conversation, $anggota, richDocument("Pesan {$m} {$i}"));
                $post->handle($conversation, $kadiv, richDocument("Balasan {$m} {$i}"), [], $root);
                $react->handle($root, $kadiv, '👍');
            }
        }

        // Laporan harian (monitoring), rapat, catatan dan kandidat: B's share of the per-module growth.
        $tasks = $board->tasks()->orderBy('id')->limit(30)->pluck('id')->all();
        $monday = $today->startOfWeek();

        foreach (User::query()->where('company_id', $company->id)->active()->orderBy('email')->offset(($round - 1) * 15)->limit(15)->get() as $index => $user) {
            foreach ([0, 1, 2] as $offset) {
                $report = DailyReport::query()->firstOrCreate(
                    ['user_id' => $user->id, 'report_date' => $monday->addDays($offset)->toDateString()],
                    ['company_id' => $company->id, 'summary' => "Laporan {$m}", 'blockers' => $index % 3 === 0 ? "Hambatan {$m}" : null, 'submitted_at' => now()],
                );
                DailyReportItem::query()->create([
                    'daily_report_id' => $report->id,
                    'task_id' => $tasks[($index + $offset) % max(1, count($tasks))] ?? null,
                    'task_key' => 'ZZBT-'.($index + 1),
                    'progress_note' => "Progres {$m}",
                    'position' => 0,
                ]);
            }
        }

        $people = User::query()->where('company_id', $company->id)->active()->orderBy('email')->limit(5)->get()->all();
        Meeting::factory()->count(4)->by($kadiv)->at($today->toDateString().' 15:00')->withParticipants($people)->create(['title' => "Rapat volume {$m}"]);
        Meeting::factory()->count(2)->by($world->direksi)->leadership()->at($today->toDateString().' 08:00')->withParticipants($people)->create(['title' => "Rapat pimpinan {$m}"]);

        foreach (range(1, 4) as $i) {
            Note::factory()->in($board)->by($kadiv)->create(['title' => "Catatan volume {$m} {$round}.{$i}", 'content_text' => "barang {$m}"]);
        }

        $position = HiringPosition::query()->whereKey($world->hiringPosition->id)->firstOrFail();

        foreach (range(1, 8) as $i) {
            Candidate::factory()->forPosition($position)->withChecklist()->create(['full_name' => "Kandidat {$m} {$round}.{$i}"]);
        }
    }
}

/**
 * @return array<string, mixed>
 */
function richDocument(string $text): array
{
    return ['type' => 'doc', 'content' => [['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => $text]]]]];
}
