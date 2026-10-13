<?php

use App\Domain\Briefings\Enums\BriefingPeriod;
use App\Domain\Tasks\Actions\CreateTask;
use App\Domain\Workspaces\Actions\EnsurePersonalWorkspace;
use App\Models\Announcement;
use App\Models\Briefing;
use App\Models\Company;
use App\Models\DailyReport;
use App\Models\Meeting;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Laravel\Sanctum\Sanctum;
use Tests\Support\AnalyticsFixtures as F;

require_once __DIR__.'/../../Support/meeting-helpers.php';
require_once __DIR__.'/../../Support/workspace-helpers.php';

/*
| API v1 — GET /beranda (Bagian 2 / B2-B): one aggregated payload for the
| Beranda saya screen, built from the web dashboard queries. Selasa 6 Okt
| 2026 09.00 WIB (pagi: jendela briefing terbuka).
*/

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    config(['features.meetings' => true, 'features.automation' => true]);
    F::reset();
    $this->travelTo(CarbonImmutable::parse('2026-10-06 09:00', 'Asia/Jakarta'));
    $this->org = F::org();
});

test('a staff member gets every section of the home screen and never a leave balance', function () {
    $rizky = $this->org['rizky'];
    $kadiv = $this->org['kadiv'];

    // Tugas: satu pribadi, satu titipan atasan di workspace tim.
    $personal = app(EnsurePersonalWorkspace::class)->handle($rizky);
    app(CreateTask::class)->handle($personal, $rizky, ['title' => 'Susun laporan', 'due_date' => '2026-10-06']);
    $team = Workspace::factory()->team()->ownedBy($kadiv)->create(['key' => 'TMG']);
    addMember($team, $rizky);
    app(CreateTask::class)->handle($team, $kadiv, ['title' => 'Cek stok gudang', 'due_date' => '2026-10-06', 'assignee_ids' => [$rizky->id]]);

    Briefing::query()->create(['company_id' => $rizky->company_id, 'period' => BriefingPeriod::Pagi, 'briefing_date' => '2026-10-06', 'content' => 'Target hari ini.', 'created_by' => $this->org['hr']->id]);
    Announcement::factory()->by($this->org['hr'])->create(['title' => 'Libur bersama']);
    Meeting::factory()->by($kadiv)->at('2026-10-06 14:00', 30)->withParticipants([$rizky])->create(['title' => 'Koordinasi gudang']);
    Meeting::factory()->by($kadiv)->at('2026-10-08 10:00', 30)->withParticipants([$rizky])->create(['title' => 'Nanti']);

    Sanctum::actingAs($rizky);

    $this->getJson('/api/v1/beranda')
        ->assertOk()
        ->assertJsonPath('today', '2026-10-06')
        ->assertJsonPath('pengguna.is_staff_only', true)
        ->assertJsonPath('flags.saldo_cuti', false)
        ->assertJsonPath('flags.rapat', true)
        ->assertJsonPath('flags.briefing_catat', false)
        ->assertJsonPath('flags.pengumuman_buat', false)
        ->assertJsonPath('saldo_cuti', null)
        ->assertJsonPath('tampilan.awal', 'saya')
        ->assertJsonCount(1, 'tampilan.tersedia')
        ->assertJsonPath('tugas_hari_ini.counts', ['pribadi' => 1, 'tim' => 1, 'semua' => 2])
        ->assertJsonPath('tugas_hari_ini.tim.0.assigned_by_other', true)
        ->assertJsonPath('rapat_berikutnya.title', 'Koordinasi gudang')
        ->assertJsonPath('briefing_terakhir.content', 'Target hari ini.')
        ->assertJsonPath('briefing_catat', null)
        ->assertJsonPath('pengumuman.total', 1)
        ->assertJsonPath('pengumuman.items.0.title', 'Libur bersama')
        ->assertJsonPath('laporan_hari_ini.status', 'missing')
        ->assertJsonPath('ringkasan.period.preset', 'bulan')
        ->assertJsonPath('attendance_status.action', fn (string $action): bool => $action !== '')
        ->assertJsonPath('bagian_gagal', [])
        ->assertJsonStructure(['server_time', 'profil', 'pengajuan_terbaru', 'ringkasan' => ['kpis', 'attendance']]);
});

test('the report card follows the daily report of today', function () {
    $rizky = $this->org['rizky'];
    DailyReport::factory()->create(['user_id' => $rizky->id, 'company_id' => $rizky->company_id, 'report_date' => '2026-10-06', 'submitted_at' => now()]);

    Sanctum::actingAs($rizky);

    $this->getJson('/api/v1/beranda')->assertOk()->assertJsonPath('laporan_hari_ini.status', 'submitted');
});

test('HR sees the briefing card inside the window and the picker offers its dashboards', function () {
    Sanctum::actingAs($this->org['hr']);

    $this->getJson('/api/v1/beranda?periode=minggu')
        ->assertOk()
        ->assertJsonPath('flags.briefing_catat', true)
        ->assertJsonPath('flags.pengumuman_buat', true)
        ->assertJsonPath('flags.saldo_cuti', true)
        ->assertJsonPath('briefing_catat.can_record', true)
        ->assertJsonPath('briefing_catat.current', 'pagi')
        ->assertJsonMissingPath('briefing_catat.urls')
        ->assertJsonPath('ringkasan.period.preset', 'minggu')
        ->assertJsonPath('tampilan.awal', 'hr')
        ->assertJsonFragment(['key' => 'hr', 'label' => 'HR', 'tersedia' => true]);
});

test('a division head may open the division view and has the leave balance flag', function () {
    Sanctum::actingAs($this->org['kadiv']);

    $this->getJson('/api/v1/beranda')
        ->assertOk()
        ->assertJsonPath('tampilan.awal', 'divisi')
        ->assertJsonPath('flags.saldo_cuti', true)
        ->assertJsonPath('flags.briefing_catat', false);
});

test('Direksi lands on a view the app cannot serve yet and says so', function () {
    Sanctum::actingAs($this->org['direksi']);

    $this->getJson('/api/v1/beranda')
        ->assertOk()
        ->assertJsonPath('tampilan.awal', 'direksi')
        ->assertJsonFragment(['key' => 'direksi', 'label' => 'Direksi', 'tersedia' => false]);
});

test('with the meetings module off the next meeting card is null', function () {
    config(['features.meetings' => false]);
    Meeting::factory()->by($this->org['kadiv'])->at('2026-10-06 14:00', 30)->withParticipants([$this->org['rizky']])->create();

    Sanctum::actingAs($this->org['rizky']);

    $this->getJson('/api/v1/beranda')->assertOk()
        ->assertJsonPath('flags.rapat', false)
        ->assertJsonPath('rapat_berikutnya', null);
});

test("another company's announcements and briefings never show up", function () {
    $outsider = User::factory()->forCompany(Company::factory()->create())->create();
    Announcement::factory()->by($outsider)->create(['title' => 'Rahasia luar']);
    Briefing::query()->create(['company_id' => $outsider->company_id, 'period' => BriefingPeriod::Pagi, 'briefing_date' => '2026-10-06', 'content' => 'Rahasia.', 'created_by' => $outsider->id]);

    Sanctum::actingAs($this->org['rizky']);

    $this->getJson('/api/v1/beranda')->assertOk()
        ->assertJsonPath('pengumuman.total', 0)
        ->assertJsonPath('briefing_terakhir', null);
});

test('a failing section becomes null and is reported instead of failing the screen', function () {
    Briefing::query()->create(['company_id' => $this->org['rizky']->company_id, 'period' => BriefingPeriod::Pagi, 'briefing_date' => '2026-10-06', 'content' => 'Target.', 'created_by' => $this->org['hr']->id]);

    // Reading a briefing blows up (switched off again below; listeners cannot be removed per test).
    $armed = true;
    Briefing::retrieved(function () use (&$armed): void {
        if ($armed) {
            throw new RuntimeException('boom');
        }
    });

    Sanctum::actingAs($this->org['rizky']);

    try {
        $this->getJson('/api/v1/beranda')->assertOk()
            ->assertJsonPath('briefing_terakhir', null)
            ->assertJsonPath('bagian_gagal', ['briefing_terakhir'])
            ->assertJsonPath('tugas_hari_ini.counts.semua', 0);
    } finally {
        $armed = false;
    }
});

test('the home screen needs a token', function () {
    $this->getJson('/api/v1/beranda')->assertUnauthorized();
});
