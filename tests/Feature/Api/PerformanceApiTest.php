<?php

use App\Domain\Tasks\Enums\TaskStatusCategory as Cat;
use App\Models\AuditLog;
use App\Models\Company;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Laravel\Sanctum\Sanctum;
use Tests\Support\AnalyticsFixtures as F;

/*
| API v1 — "Kinerja saya" untuk ponsel (Bagian 2 / B2-B): PersonalPerformance
| (metrik berdampingan, tanpa skor gabungan) di balik gate viewPerformance
| (diri sendiri · atasan langsung · HR; selain itu 404) dan flag `automation`.
| Rabu 7 Okt 2026 10.00 WIB.
*/

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    config(['features.automation' => true]);
    F::reset();
    $this->travelTo(CarbonImmutable::parse('2026-10-07 10:00', 'Asia/Jakarta'));
    $this->org = $org = F::org();
    $ws = Workspace::factory()->internal()->create();

    F::task($ws, Cat::Done, [$org['rizky']], ['due_date' => '2026-10-05', 'completed_at' => '2026-10-05 10:00']); // tepat waktu
    F::task($ws, Cat::Done, [$org['rizky']], ['due_date' => '2026-10-05', 'completed_at' => '2026-10-06 10:00']); // terlambat
    F::task($ws, Cat::Todo, [$org['rizky']], ['due_date' => '2026-10-06', 'title' => 'Rekap stok']); // lewat tenggat
});

test('I read my own performance: side-by-side counts, never a combined score', function () {
    Sanctum::actingAs($this->org['rizky']);

    $response = $this->getJson('/api/v1/kinerja')
        ->assertOk()
        ->assertJsonPath('periode', 'minggu')
        ->assertJsonPath('kinerja.period', '8w')
        ->assertJsonPath('kinerja.person.is_self', true)
        ->assertJsonPath('kinerja.person.name', 'Rizky Aditya')
        ->assertJsonPath('kinerja.counts.due', 3)
        ->assertJsonPath('kinerja.counts.done_of_due', 2)
        ->assertJsonPath('kinerja.counts.on_time', 1)
        ->assertJsonPath('kinerja.overdue_count', 1)
        ->assertJsonPath('kinerja.overdue.0.title', 'Rekap stok')
        ->assertJsonCount(8, 'kinerja.weeks')
        ->assertJsonStructure(['kinerja' => ['by_workspace', 'attendance' => ['label', 'on_time_rate', 'average_check_in']]]);

    expect(array_keys($response->json('kinerja')))->not->toContain('score', 'skor');
});

test('the period slug picks month or quarter and falls back to 8 weeks', function () {
    Sanctum::actingAs($this->org['rizky']);

    $this->getJson('/api/v1/kinerja?periode=bulan')->assertOk()->assertJsonPath('periode', 'bulan')->assertJsonPath('kinerja.period', 'month');
    $this->getJson('/api/v1/kinerja?periode=kuartal')->assertOk()->assertJsonPath('periode', 'kuartal')->assertJsonPath('kinerja.period', 'quarter');
    $this->getJson('/api/v1/kinerja?periode=8-minggu')->assertOk()->assertJsonPath('periode', 'minggu');
    $this->getJson('/api/v1/kinerja?periode=ngawur')->assertOk()->assertJsonPath('kinerja.period', '8w');
});

test('a direct manager and HR read an employee, and it is audited', function () {
    Sanctum::actingAs($this->org['kadiv']);
    $this->getJson("/api/v1/kinerja/{$this->org['rizky']->id}")->assertOk()
        ->assertJsonPath('kinerja.person.is_self', false)
        ->assertJsonPath('kinerja.counts.due', 3);

    Sanctum::actingAs($this->org['hr']);
    $this->getJson("/api/v1/kinerja/{$this->org['rizky']->id}?periode=bulan")->assertOk();

    expect(AuditLog::query()->where('action', 'performance.viewed')->count())->toBe(2);
});

test('everyone else gets a 404 that does not confirm the person exists', function () {
    foreach (['sari', 'budi', 'direksi', 'kadivKeu'] as $who) {
        Sanctum::actingAs($this->org[$who]);
        $this->getJson("/api/v1/kinerja/{$this->org['rizky']->id}")->assertNotFound();
    }

    Sanctum::actingAs(User::factory()->forCompany(Company::factory()->create())->create());
    $this->getJson("/api/v1/kinerja/{$this->org['rizky']->id}")->assertNotFound();

    Sanctum::actingAs($this->org['hr']);
    $this->getJson('/api/v1/kinerja/01ARZ3NDEKTSV4RRFFQ69G5FAV')->assertNotFound();

    expect(AuditLog::query()->where('action', 'performance.viewed')->count())->toBe(0);
});

test('the module is off with the automation flag and needs a token', function () {
    $this->getJson('/api/v1/kinerja')->assertUnauthorized();

    config(['features.automation' => false]);
    Sanctum::actingAs($this->org['rizky']);
    $this->getJson('/api/v1/kinerja')->assertNotFound();
});
