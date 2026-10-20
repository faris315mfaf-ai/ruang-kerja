<?php

use App\Domain\Attendance\Events\AttendanceRecorded;
use App\Domain\HrHub\Actions\AssignHrTask;
use App\Domain\Organization\Enums\Role;
use App\Domain\Reports\Notifications\DailyReportReminder;
use App\Http\Middleware\HandleInertiaRequests;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;

require_once __DIR__.'/../../Support/tenancy-helpers.php';

/*
 * Ruang HR (/hr, keputusan pemilik 20 Okt 2026): only HR and Super Admin,
 * six tabs with their props, and nothing of another company.
 */

beforeEach(function () {
    Event::fake([AttendanceRecorded::class]);
    $this->home = homeWorld();
    $this->foreign = foreignWorld();
});

/**
 * The page plus every deferred group (as the browser loads them).
 */
function ruangHrContent(User $user, string $url): string
{
    $response = test()->actingAs($user)->get($url)->assertOk();
    $page = $response->viewData('page');
    $content = (string) $response->getContent();
    $deferred = $page['deferredProps'] ?? [];

    if ($deferred !== []) {
        $content .= (string) test()->actingAs($user)->get($url, [
            'X-Inertia' => 'true',
            'X-Inertia-Version' => (string) app(HandleInertiaRequests::class)->version(request()),
            'X-Inertia-Partial-Component' => $page['component'],
            'X-Inertia-Partial-Data' => implode(',', array_merge(...array_values($deferred))),
        ])->assertOk()->getContent();
    }

    return $content;
}

dataset('ruang hr pages', [
    'ringkasan' => ['/hr', 'hr/summary'],
    'absensi' => ['/hr/absensi', 'hr/attendance'],
    'monitoring' => ['/hr/monitoring', 'hr/monitoring'],
    'beban kerja' => ['/hr/monitoring?tampil=beban', 'hr/monitoring'],
    'penugasan' => ['/hr/penugasan', 'hr/assignments'],
    'jadwal' => ['/hr/jadwal', 'hr/schedule'],
    'catatan' => ['/hr/catatan', 'hr/notes'],
]);

it('opens every tab for HR and Super Admin without data of another company', function (string $url, string $component) {
    foreach ([$this->home->hr, $this->home->superAdmin] as $user) {
        $this->actingAs($user)->get($url)
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component($component)
                ->has('hub.today')
                ->where('hub.workspaces.team.name', 'Tim HR')
                ->where('hub.workspaces.assignments.name', 'Penugasan HR'));

        expect(leaksForeign(ruangHrContent($user, $url)))->toBeFalse();
    }
})->with('ruang hr pages');

it('refuses Ruang HR to Direksi, Kepala Divisi and members (403)', function (string $url) {
    foreach (['direksi', 'kadiv', 'anggota'] as $who) {
        $this->actingAs($this->home->{$who})->get($url)->assertForbidden();
    }
})->with('ruang hr pages');

it('refuses the Ruang HR actions to everyone but HR and Super Admin, before validation', function () {
    foreach (['direksi', 'kadiv', 'anggota'] as $who) {
        $this->actingAs($this->home->{$who})->post('/hr/penugasan', [])->assertForbidden();
        $this->actingAs($this->home->{$who})->post('/hr/monitoring/ingatkan', ['all' => true])->assertForbidden();
    }

    $inactive = User::factory()->withRole(Role::Hr)->inactive()->create();
    expect(Gate::forUser($inactive)->allows('viewHrHub'))->toBeFalse()
        ->and(Gate::forUser($this->home->hr)->allows('viewHrHub'))->toBeTrue()
        ->and(Gate::forUser($this->home->superAdmin)->allows('viewHrHub'))->toBeTrue();
});

it('sends HR to Ruang HR from /dashboard and shares the home link', function () {
    $this->actingAs($this->home->hr)->get('/dashboard')->assertRedirect('/hr');
    $this->actingAs($this->home->hr)->get('/dashboard/hr')->assertRedirect('/hr');
    $this->actingAs($this->home->superAdmin)->get('/dashboard/hr')->assertRedirect('/hr');

    $this->actingAs($this->home->hr)->get('/hr')->assertInertia(fn (Assert $page) => $page->where('auth.home', '/hr'));
    $this->actingAs($this->home->anggota)->get('/dashboard')->assertInertia(fn (Assert $page) => $page->where('auth.home', '/dashboard'));
    // Super Admin keeps "Saya" as Beranda and opens Ruang HR from the menu.
    $this->actingAs($this->home->superAdmin)->get('/dashboard')->assertInertia(fn (Assert $page) => $page
        ->component('dashboard/personal')
        ->where('auth.home', '/dashboard'));
});

it('shapes the Ringkasan props', function () {
    app(AssignHrTask::class)->handle($this->home->hr, [
        'user_ids' => [$this->home->anggota->id],
        'mode' => 'per_person',
        'title' => 'Kumpulkan NPWP',
        'due_date' => now()->subDays(2)->toDateString(),
        'checklist' => ['Foto NPWP'],
    ]);

    $this->actingAs($this->home->hr)->get('/hr')
        ->assertInertia(fn (Assert $page) => $page
            ->component('hr/summary')
            ->has('summary.kpis', 12)
            ->where('summary.kpis.assignments_open', 1)
            ->where('summary.kpis.assignments_overdue', 1)
            ->has('summary.actions.items')
            ->has('summary.actions.total')
            ->has('summary.agenda')
            ->has('summary.divisions')
            ->where('summary.assignments.0.title', 'Kumpulkan NPWP')
            ->where('summary.assignments.0.status', 'overdue')
            ->where('summary.assignments.0.overdue_days', 2)
            ->where('summary.assignments.0.checklist', ['done' => 0, 'total' => 1])
            ->where('summary.assignments.0.assignees.0.id', $this->home->anggota->id)
            ->has('summary.notes')
            ->has('briefing'));
});

it('lists HR assignments with status counts and filters', function () {
    $assign = app(AssignHrTask::class);
    $assign->handle($this->home->hr, ['user_ids' => [$this->home->anggota->id, $this->home->kadiv->id], 'mode' => 'per_person', 'title' => 'Isi formulir BPJS']);
    $assign->handle($this->home->hr, ['user_ids' => [$this->home->anggota->id], 'mode' => 'shared', 'title' => 'Pelatihan K3', 'due_date' => now()->subDay()->toDateString()]);

    $this->actingAs($this->home->hr)->get('/hr/penugasan')
        ->assertInertia(fn (Assert $page) => $page
            ->where('assignments.counts', ['not_started' => 2, 'in_progress' => 0, 'overdue' => 1, 'done' => 0, 'all' => 3])
            ->has('assignments.rows', 3)
            ->where('limits', ['recipients' => 200, 'checklist' => 20])
            ->loadDeferredProps('pemilih', fn (Assert $reload) => $reload
                ->has('pickers.people')
                ->has('pickers.divisions')
                ->has('pickers.teams')));

    $this->actingAs($this->home->hr)->get('/hr/penugasan?status=overdue')
        ->assertInertia(fn (Assert $page) => $page
            ->where('assignments.status', 'overdue')
            ->has('assignments.rows', 1)
            ->where('assignments.rows.0.title', 'Pelatihan K3')
            ->where('assignments.rows.0.status_label', 'Terlambat'));
});

it('gives tasks from Ruang HR and flashes the result', function () {
    $this->actingAs($this->home->hr)->from('/hr/penugasan')
        ->post('/hr/penugasan', [
            'user_ids' => [$this->home->anggota->id, $this->home->kadiv->id],
            'mode' => 'per_person',
            'title' => 'Perbarui data rekening',
            'checklist' => ['Buku tabungan', ''],
        ])
        ->assertRedirect('/hr/penugasan')
        ->assertSessionHasNoErrors();

    $this->actingAs($this->home->hr)->from('/hr/penugasan')
        ->post('/hr/penugasan', ['mode' => 'shared', 'title' => 'Tanpa penerima'])
        ->assertRedirect('/hr/penugasan')
        ->assertSessionHasErrors('recipients');

    $this->actingAs($this->home->hr)->from('/hr/penugasan')
        ->post('/hr/penugasan', ['user_ids' => [$this->home->anggota->id], 'mode' => 'x', 'title' => ''])
        ->assertSessionHasErrors(['mode', 'title']);
});

it('returns the monitoring, schedule and notes props', function () {
    $this->actingAs($this->home->hr)->get('/hr/monitoring?tanggal=2000-01-01&tampil=beban')
        ->assertInertia(fn (Assert $page) => $page
            ->where('monitoring.date', '2000-01-01')
            ->where('monitoring.view', 'beban')
            ->where('monitoring.can_remind', false)
            ->loadDeferredProps(fn (Assert $reload) => $reload
                ->has('daily.totals')
                ->has('daily.reports')
                ->has('workload.divisions')));

    $this->actingAs($this->home->hr)->get('/hr/monitoring?tanggal=2999-01-01')
        ->assertInertia(fn (Assert $page) => $page->where('monitoring.date', $page->toArray()['props']['monitoring']['today'])->where('monitoring.can_remind', true));

    $this->actingAs($this->home->hr)->get('/hr/jadwal?bulan=2026-02')
        ->assertInertia(fn (Assert $page) => $page
            ->where('calendar.month', '2026-02')
            ->where('calendar.from', '2026-01-26')
            ->where('calendar.to', '2026-03-01')
            ->has('calendar.week'));

    $this->actingAs($this->home->hr)->get('/hr/catatan')
        ->assertInertia(fn (Assert $page) => $page
            ->where('notes.enabled', (bool) config('features.notes'))
            ->where('notes.workspace.name', 'Tim HR'));
});

it('reminds missing daily reports from Ruang HR', function () {
    Notification::fake();
    // A Monday afternoon: Rizky (shift Senin–Jumat) has not sent today's report.
    $this->travelTo(CarbonImmutable::parse('2026-10-19 16:00', 'Asia/Jakarta'));

    $this->actingAs($this->home->hr)->from('/hr/monitoring')
        ->post('/hr/monitoring/ingatkan', ['user_ids' => [$this->home->anggota->id]])
        ->assertRedirect('/hr/monitoring');

    Notification::assertSentTo($this->home->anggota, DailyReportReminder::class);
});
