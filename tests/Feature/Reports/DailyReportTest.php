<?php

use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\Holiday;
use App\Domain\Attendance\Models\ShiftAssignment;
use App\Domain\Attendance\Services\ScheduleResolver;
use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Notifications\Services\NotificationDispatchLog;
use App\Domain\Organization\Enums\Role;
use App\Domain\Reports\Jobs\SendDailyReportReminders;
use App\Domain\Reports\Notifications\DailyReportReminder;
use App\Domain\Reports\Queries\DailyReportFeed;
use App\Domain\Tasks\Enums\TaskStatusCategory as Cat;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Models\Company;
use App\Models\DailyReport;
use App\Models\EmployeeRequest;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\AnalyticsFixtures as F;

require_once __DIR__.'/../../Support/workspace-helpers.php';

/*
 * Laporan progres harian (keputusan pemilik 6 Okt 2026). Wednesday
 * 7 Oct 2026 14.00 WIB; Rizky (staf, Operasional) reports to Dimas (Kadiv).
 */
beforeEach(function () {
    $this->seed(RoleSeeder::class);
    F::reset();
    $this->travelTo(CarbonImmutable::parse('2026-10-07 14:00', 'Asia/Jakarta'));
    $this->org = F::org();
    $this->me = $this->org['rizky'];

    $this->project = Workspace::factory()->internal()->create(['key' => 'PRJ']);
    addMember($this->project, $this->me);
    // Private team workspace: Dimas (Kadiv) cannot see it.
    $this->private = Workspace::factory()->state(['type' => 'team'])->create(['key' => 'PRV']);
    addMember($this->private, $this->me);
    // Rizky is only a viewer here: he may not move its tasks.
    $this->readOnly = Workspace::factory()->internal()->create(['key' => 'RO']);
    addMember($this->readOnly, $this->me, WorkspaceRole::Viewer);

    $this->task = F::task($this->project, Cat::InProgress, [$this->me], ['title' => 'Rekap stok gudang']);
    $this->secret = F::task($this->private, Cat::Todo, [$this->me], ['title' => 'Rahasia tim']);
    $this->locked = F::task($this->readOnly, Cat::Todo, [], ['title' => 'Hanya lihat']);
});

/**
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function reportPayload(array $overrides = []): array
{
    return [
        'report_date' => '2026-10-07',
        'summary' => "Rekap stok selesai.\nLanjut besok.",
        'blockers' => 'Menunggu data cabang.',
        'notes' => 'Notulen singkat rapat pagi.',
        'items' => [],
        ...$overrides,
    ];
}

it('lets the owner write a draft that survives a reload', function () {
    $this->actingAs($this->me)->putJson('/laporan/hari-ini', reportPayload(['items' => [
        ['task_id' => $this->task->id, 'progress_note' => 'Separuh selesai', 'percent' => 50, 'hours' => 3.5],
        ['task_id' => null, 'progress_note' => 'Membantu stok opname'],
    ]]))->assertOk()
        ->assertJsonPath('report.status', 'draft')
        ->assertJsonPath('report.items.0.task_key', 'PRJ-1')
        ->assertJsonPath('report.items.0.task_title', 'Rekap stok gudang')
        ->assertJsonPath('report.items.1.is_task', false)
        ->assertJsonPath('report.hours', 3.5);

    $this->actingAs($this->me)->get('/laporan/hari-ini')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('reports/today')
            ->where('report.status', 'draft')
            ->where('report.summary', "Rekap stok selesai.\nLanjut besok.")
            ->where('report.items.0.percent', 50)
            ->where('suggestions', fn ($tasks) => collect($tasks)->pluck('key')->contains('PRJ-1'))
            ->where('chosen.0.key', 'PRJ-1'));

    $report = DailyReport::query()->sole();
    expect($report->submitted_at)->toBeNull()->and($report->items)->toHaveCount(2);
});

it('sends the report, moves tasks through MoveTask and keeps it editable until 23.59', function () {
    $done = F::status($this->project, Cat::Done);

    $this->actingAs($this->me)->postJson('/laporan/hari-ini/kirim', reportPayload(['items' => []]))
        ->assertUnprocessable()->assertJsonValidationErrors('items');
    $this->actingAs($this->me)->postJson('/laporan/hari-ini/kirim', reportPayload(['items' => [['task_id' => $this->task->id, 'progress_note' => '']]]))
        ->assertUnprocessable()->assertJsonValidationErrors('items.0.progress_note');

    $this->actingAs($this->me)->postJson('/laporan/hari-ini/kirim', reportPayload(['items' => [
        ['task_id' => $this->task->id, 'progress_note' => 'Selesai', 'percent' => 100, 'move_status_id' => $done->id],
    ]]))->assertOk()
        ->assertJsonPath('report.status', 'submitted')
        ->assertJsonPath('report.items.0.status_category_after', 'done');

    expect($this->task->refresh()->status_id)->toBe($done->id)
        ->and($this->task->status_category)->toBe(Cat::Done);
    $sentAt = DailyReport::query()->sole()->submitted_at;

    // Changed again the same evening: still allowed, first send time kept.
    $this->travelTo(CarbonImmutable::parse('2026-10-07 23:58', 'Asia/Jakarta'));
    $this->actingAs($this->me)->putJson('/laporan/hari-ini', reportPayload(['summary' => 'Revisi', 'items' => [
        ['task_id' => $this->task->id, 'progress_note' => 'Selesai, diperiksa', 'move_status_id' => $done->id],
    ]]))->assertOk()
        ->assertJsonPath('report.status', 'submitted')
        ->assertJsonPath('report.items.0.status_category_after', 'done');
    expect(DailyReport::query()->sole()->submitted_at?->equalTo($sentAt))->toBeTrue();

    // After midnight the report of the 7th is locked; today is a new report.
    $this->travelTo(CarbonImmutable::parse('2026-10-08 00:01', 'Asia/Jakarta'));
    $this->actingAs($this->me)->putJson('/laporan/hari-ini', reportPayload(['summary' => 'Terlambat']))
        ->assertUnprocessable()->assertJsonValidationErrors('report_date');
    expect(DailyReport::query()->sole()->summary)->toBe('Revisi');

    $this->actingAs($this->me)->get("/laporan/{$this->me->id}/2026-10-07")
        ->assertInertia(fn (Assert $page) => $page->where('report.editable', false)->where('mine', true));
    $this->actingAs($this->me)->get('/laporan/hari-ini')
        ->assertInertia(fn (Assert $page) => $page->where('report.date', '2026-10-08')->where('report.status', 'missing'));
});

it('keeps task moves under the task policy and tasks under workspace visibility', function () {
    $done = F::status($this->readOnly, Cat::Done);

    $this->actingAs($this->me)->putJson('/laporan/hari-ini', reportPayload(['items' => [
        ['task_id' => $this->locked->id, 'progress_note' => 'Dicek', 'move_status_id' => $done->id],
    ]]))->assertUnprocessable()->assertJsonValidationErrors('items.0.move_status_id');
    expect($this->locked->refresh()->status_category)->toBe(Cat::Todo);

    // A column of another workspace is refused too.
    $this->actingAs($this->me)->putJson('/laporan/hari-ini', reportPayload(['items' => [
        ['task_id' => $this->task->id, 'progress_note' => 'x', 'move_status_id' => $done->id],
    ]]))->assertUnprocessable()->assertJsonValidationErrors('items.0.move_status_id');

    // Reporting on the read-only task without moving it is fine.
    $this->actingAs($this->me)->putJson('/laporan/hari-ini', reportPayload(['items' => [
        ['task_id' => $this->locked->id, 'progress_note' => 'Dicek'],
    ]]))->assertOk();

    // A task Rizky cannot see.
    $hidden = F::task(Workspace::factory()->create(['key' => 'HID']), Cat::Todo, []);
    $this->actingAs($this->me)->putJson('/laporan/hari-ini', reportPayload(['items' => [
        ['task_id' => $hidden->id, 'progress_note' => 'x'],
    ]]))->assertUnprocessable()->assertJsonValidationErrors('items.0.task_id');

    // Same task twice.
    $this->actingAs($this->me)->putJson('/laporan/hari-ini', reportPayload(['items' => [
        ['task_id' => $this->task->id, 'progress_note' => 'a'],
        ['task_id' => $this->task->id, 'progress_note' => 'b'],
    ]]))->assertUnprocessable()->assertJsonValidationErrors('items');

    // The picker search only finds visible tasks and offers columns only where moving is allowed.
    $this->actingAs($this->me)->getJson('/laporan/tugas?q=hanya')
        ->assertOk()->assertJsonPath('tasks.0.key', 'RO-1')->assertJsonPath('tasks.0.can_move', false)->assertJsonPath('tasks.0.statuses', []);
    $this->actingAs($this->me)->getJson('/laporan/tugas?q=PRJ-1')
        ->assertOk()->assertJsonPath('tasks.0.can_move', true)->assertJsonCount(5, 'tasks.0.statuses');
    $this->actingAs($this->me)->getJson('/laporan/tugas?q=HID')->assertOk()->assertJsonCount(0, 'tasks');
});

it('lets the direct manager, the division head, Direksi, HR and Super Admin read sent reports only', function () {
    $this->actingAs($this->me)->postJson('/laporan/hari-ini/kirim', reportPayload(['items' => [
        ['task_id' => $this->task->id, 'progress_note' => 'Publik'],
        ['task_id' => $this->secret->id, 'progress_note' => 'Privat'],
    ]]))->assertOk();
    // A draft of an earlier day is never shown to readers.
    DailyReport::factory()->draft()->on('2026-10-06')->create(['user_id' => $this->me->id, 'company_id' => $this->me->company_id]);

    foreach (['kadiv', 'hr', 'direksi', 'admin'] as $who) {
        $this->actingAs($this->org[$who])->get("/laporan/{$this->me->id}")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('reports/index')->where('mine', false)->has('reports', 1));
    }

    // Dimas cannot see the private team workspace: key only, no title.
    $this->actingAs($this->org['kadiv'])->get("/laporan/{$this->me->id}/2026-10-07")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('report.items.0.task_title', 'Rekap stok gudang')
            ->where('report.items.1.task_key', 'PRV-1')
            ->where('report.items.1.task_title', null)
            ->where('report.items.1.task_id', null));
    $this->actingAs($this->org['direksi'])->get("/laporan/{$this->me->id}/2026-10-07")
        ->assertInertia(fn (Assert $page) => $page->where('report.items.1.task_title', 'Rahasia tim'));

    $this->actingAs($this->org['kadiv'])->get("/laporan/{$this->me->id}/2026-10-06")->assertNotFound();

    // Peers, another division's head, another company and inactive viewers: 404.
    foreach ([$this->org['sari'], $this->org['kadivKeu'], $this->org['budi']] as $other) {
        $this->actingAs($other)->get("/laporan/{$this->me->id}")->assertNotFound();
        $this->actingAs($other)->get("/laporan/{$this->me->id}/2026-10-07")->assertNotFound();
    }

    $outsider = User::factory()->withRole(Role::Direksi)->forCompany(Company::factory()->create())->create();
    $this->actingAs($outsider)->get("/laporan/{$this->me->id}")->assertNotFound();

    $owner = $this->me;
    expect(Gate::forUser(User::factory()->withRole(Role::Hr)->inactive()->create())->allows('viewReportsOf', [DailyReport::class, $owner]))->toBeFalse();
});

it('matches the read matrix of DailyReportPolicy', function (string $who, bool $reads) {
    $owner = $this->me;
    $viewer = $who === 'self' ? $owner : $this->org[$who];

    expect(Gate::forUser($viewer)->allows('viewReportsOf', [DailyReport::class, $owner]))->toBe($reads);
})->with([
    'pemilik' => ['self', true],
    'atasan langsung (Kadiv)' => ['kadiv', true],
    'kadiv lain' => ['kadivKeu', false],
    'rekan' => ['sari', false],
    'hr' => ['hr', true],
    'direksi' => ['direksi', true],
    'super_admin' => ['admin', true],
]);

it('reads by division headship even without being the direct manager', function () {
    $other = User::factory()->withRole(Role::Anggota)->inDivision($this->org['ops'])->managedBy($this->org['sari'])->create();

    expect(Gate::forUser($this->org['kadiv'])->allows('viewReportsOf', [DailyReport::class, $other]))->toBeTrue()
        ->and(Gate::forUser($this->org['sari'])->allows('viewReportsOf', [DailyReport::class, $other]))->toBeTrue()
        ->and(Gate::forUser($this->org['kadivKeu'])->allows('viewReportsOf', [DailyReport::class, $other]))->toBeFalse();
});

it('builds the shared team feed for a reader', function () {
    $this->actingAs($this->me)->postJson('/laporan/hari-ini/kirim', reportPayload(['items' => [
        ['task_id' => $this->secret->id, 'progress_note' => 'Privat', 'hours' => 2],
    ]]))->assertOk();
    DailyReport::factory()->draft()->create(['user_id' => $this->org['sari']->id, 'company_id' => $this->me->company_id, 'summary' => 'Belum']);

    $feed = app(DailyReportFeed::class)->forDate($this->me->company_id, '2026-10-07', $this->org['kadiv']);

    expect($feed['counts'])->toBe(['total' => 2, 'submitted' => 1, 'draft' => 1, 'missing' => 0])
        ->and($feed['people'][0]['user']['name'])->toBe('Rizky Aditya')
        ->and($feed['people'][0]['report']['items'][0]['task_title'])->toBeNull()
        ->and($feed['people'][0]['report']['items'][0]['task_key'])->toBe('PRV-1')
        ->and($feed['people'][0]['report']['hours'])->toBe(2.0)
        ->and($feed['people'][1]['status'])->toBe('draft')
        ->and($feed['people'][1]['report'])->toBeNull();

    // Direksi reads everyone except themselves; a staff member reads nobody.
    expect(app(DailyReportFeed::class)->forDate($this->me->company_id, '2026-10-07', $this->org['direksi'])['counts']['total'])
        ->toBe(User::query()->where('company_id', $this->me->company_id)->count() - 1)
        ->and(app(DailyReportFeed::class)->forDate($this->me->company_id, '2026-10-07', $this->me)['people'])->toBe([]);

    $this->actingAs($this->org['kadiv'])->get('/laporan')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('reports/index')
            ->where('mine', true)
            ->loadDeferredProps(fn (Assert $reload) => $reload->where('team.counts.submitted', 1)));
});

it('keeps Beranda free of the report card since the 9 Oct 2026 dashboard', function () {
    // "Laporan hari ini" moved off Beranda; "Tugas hari ini" replaced it.
    $this->actingAs($this->me)->get('/dashboard/saya')
        ->assertInertia(fn (Assert $page) => $page
            ->missing('dailyReport')
            ->where('tugasHariIni.today', '2026-10-07')
            ->where('briefing', null));

    $this->actingAs($this->me)->postJson('/laporan/hari-ini/kirim', reportPayload(['items' => [['progress_note' => 'Rapat vendor']]]))->assertOk();

    // Sending the report still works; Beranda stays as it was.
    $this->actingAs($this->me)->get('/dashboard/saya')
        ->assertInertia(fn (Assert $page) => $page->missing('dailyReport'));
    expect(DailyReport::query()->where('user_id', $this->me->id)->where('report_date', '2026-10-07')->count())->toBe(1);
});

it('reminds scheduled employees at 16.30 once, not those who sent, are off or on leave', function () {
    Notification::fake();
    $shift = F::shift();
    $scheduled = fn (User $user) => ShiftAssignment::factory()->for($user)->for($shift)->between('2026-01-01')->create();
    $scheduled($this->me);
    $scheduled($this->org['sari']);
    $scheduled($this->org['budi']);
    // Budi is on approved leave today.
    F::day($this->org['budi'], '2026-10-07', AttendanceStatus::Leave, ['request_id' => null]);
    AttendanceDay::query()->where('user_id', $this->org['budi']->id)->update(['request_id' => EmployeeRequest::factory()->create(['user_id' => $this->org['budi']->id])->id]);
    // Sari already sent.
    DailyReport::factory()->create(['user_id' => $this->org['sari']->id, 'company_id' => $this->me->company_id]);

    $this->travelTo(CarbonImmutable::parse('2026-10-07 16:30', 'Asia/Jakarta'));
    (new SendDailyReportReminders)->handle(app(ScheduleResolver::class), app(NotificationDispatchLog::class));
    (new SendDailyReportReminders)->handle(app(ScheduleResolver::class), app(NotificationDispatchLog::class));

    Notification::assertSentToTimes($this->me, DailyReportReminder::class, 1);
    Notification::assertNotSentTo($this->org['sari'], DailyReportReminder::class);
    Notification::assertNotSentTo($this->org['budi'], DailyReportReminder::class);
    // No shift at all (Dimas): no reminder.
    Notification::assertNotSentTo($this->org['kadiv'], DailyReportReminder::class);

    $notification = new DailyReportReminder('2026-10-07');
    expect($notification->type())->toBe(NotificationType::ReportReminder)
        ->and($notification->via($this->me))->not->toContain('mail');

    // A holiday: nobody is reminded.
    Holiday::factory()->create(['company_id' => $this->me->company_id, 'date' => '2026-10-08']);
    $this->travelTo(CarbonImmutable::parse('2026-10-08 16:30', 'Asia/Jakarta'));
    (new SendDailyReportReminders)->handle(app(ScheduleResolver::class), app(NotificationDispatchLog::class));
    Notification::assertSentToTimes($this->me, DailyReportReminder::class, 1);
});

it('is scheduled at 16.30 on weekdays', function () {
    $event = collect(app(Schedule::class)->events())
        ->first(fn ($event) => str_contains((string) $event->description, 'SendDailyReportReminders'));

    expect($event)->not->toBeNull()
        ->and($event->expression)->toBe('30 16 * * 1-5')
        ->and($event->timezone)->toBe('Asia/Jakarta');
});
