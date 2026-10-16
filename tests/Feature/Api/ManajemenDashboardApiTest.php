<?php

use App\Models\ManagementNote;
use App\Models\Meeting;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Laravel\Sanctum\Sanctum;
use Tests\Support\AnalyticsFixtures as F;

require_once __DIR__.'/../../Support/project-helpers.php';

/*
| API v1 — Dashboard Manajemen + catatan tindakan (Bagian 5 / B5-A): kepala
| halaman, blok ringkasan / proyek / beban kerja (ManagementDashboard web),
| "Jadwal terdekat" dari rapat pimpinan, dan catatan tindakan pribadi
| (ManagementNotePolicy: orang lain 404). Selasa 13 Okt 2026 10.00 WIB.
*/

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    F::reset();
    $this->travelTo(CarbonImmutable::parse('2026-10-13 10:00', 'Asia/Jakarta'));
    $this->org = F::org();
    config(['features.meetings' => true]);
});

function manajemenAs(object $test, string $who): User
{
    $user = $test->org[$who];
    Sanctum::actingAs($user);

    return $user;
}

describe('dashboard', function () {
    it('opens the header with own notes and the upcoming leadership meetings', function () {
        $direksi = $this->org['direksi'];
        ManagementNote::factory()->ownedBy($direksi)->create(['body' => 'Telepon vendor', 'position' => 'a']);
        ManagementNote::factory()->ownedBy($this->org['hr'])->create(['body' => 'Catatan HR']);

        $soon = Meeting::factory()->by($this->org['kadiv'])->leadership()->at('2026-10-14 09:00')->create(['title' => 'Rapat pimpinan mingguan']);
        Meeting::factory()->by($this->org['kadiv'])->leadership()->at('2026-10-12 09:00')->create(['title' => 'Kemarin']);
        Meeting::factory()->by($this->org['kadiv'])->leadership()->at('2026-11-20 09:00')->create(['title' => 'Terlalu jauh']);
        Meeting::factory()->by($this->org['kadiv'])->at('2026-10-14 13:00')->create(['title' => 'Rapat tim biasa']);

        manajemenAs($this, 'direksi');

        $this->getJson('/api/v1/manajemen')
            ->assertOk()
            ->assertJsonPath('today', '2026-10-13')
            ->assertJsonPath('can', ['portfolio' => true, 'notes' => true, 'schedule' => true])
            ->assertJsonCount(1, 'notes')
            ->assertJsonPath('notes.0.body', 'Telepon vendor')
            ->assertJsonCount(1, 'schedule')
            ->assertJsonPath('schedule.0.id', $soon->id)
            ->assertJsonPath('schedule.0.title', 'Rapat pimpinan mingguan')
            ->assertJsonPath('schedule.0.starts_at', '2026-10-14T02:00:00Z')
            ->assertJsonStructure(['company']);

        $this->getJson('/api/v1/manajemen/jadwal-terdekat')->assertOk()->assertJsonCount(1, 'schedule');
    });

    it('keeps the portfolio link from HR and empties the schedule when meetings are off', function () {
        config(['features.meetings' => false]);
        Meeting::factory()->by($this->org['kadiv'])->leadership()->at('2026-10-14 09:00')->create();
        manajemenAs($this, 'hr');

        $this->getJson('/api/v1/manajemen')->assertOk()
            ->assertJsonPath('can', ['portfolio' => false, 'notes' => true, 'schedule' => false])
            ->assertJsonPath('schedule', []);
    });

    it('serves the summary, project and workload blocks', function () {
        $project = makeProject($this->org['kadiv'], ['key' => 'PLQ', 'name' => 'Peluncuran Q4']);
        projectTasks($project, 'todo', 1, ['due_date' => '2026-10-01']);
        manajemenAs($this, 'direksi');

        $this->getJson('/api/v1/manajemen/ringkasan')->assertOk()
            ->assertJsonStructure([
                'generated_at',
                'attendance' => ['date', 'counts' => ['scheduled', 'present', 'on_time', 'late', 'away', 'not_checked_in', 'absent'], 'divisions'],
                'periods' => ['harian' => ['range', 'attendance', 'tasks', 'overdue', 'chart'], 'mingguan' => ['range', 'attendance', 'tasks', 'on_time', 'chart'], 'bulanan' => ['range', 'chart']],
            ]);

        $this->getJson('/api/v1/manajemen/proyek')->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('projects.0.key', 'PLQ')
            ->assertJsonStructure(['attention' => ['count', 'items'], 'milestones' => ['month', 'items']]);

        $this->getJson('/api/v1/manajemen/beban-kerja')->assertOk()
            ->assertJsonStructure(['total' => ['open', 'overdue', 'people'], 'divisions' => [['id', 'name', 'open', 'overdue', 'people']]]);
    });

    it('is closed to Kepala Divisi and staff', function () {
        foreach (['kadiv', 'rizky'] as $who) {
            manajemenAs($this, $who);

            foreach (['', '/ringkasan', '/proyek', '/beban-kerja', '/jadwal-terdekat'] as $path) {
                $this->getJson('/api/v1/manajemen'.$path)->assertForbidden();
            }
        }
    });
});

describe('catatan tindakan', function () {
    it('lists, adds, edits and completes own notes', function () {
        manajemenAs($this, 'direksi');

        $this->getJson('/api/v1/catatan-tindakan')->assertOk()->assertJsonPath('notes', [])->assertJsonPath('limit', 200);

        $id = $this->postJson('/api/v1/catatan-tindakan', ['body' => 'Tinjau anggaran Q4', 'due_on' => '2026-10-12'])
            ->assertCreated()
            ->assertJsonPath('note.body', 'Tinjau anggaran Q4')
            ->assertJsonPath('note.overdue', true)
            ->assertJsonPath('note.done', false)
            ->json('note.id');

        $this->patchJson("/api/v1/catatan-tindakan/{$id}", ['body' => 'Tinjau anggaran Q4 + Q1', 'due_on' => null])
            ->assertOk()->assertJsonPath('note.due_on', null)->assertJsonPath('note.overdue', false);

        $this->patchJson("/api/v1/catatan-tindakan/{$id}", ['done' => true])
            ->assertOk()->assertJsonPath('note.done', true);

        $this->postJson('/api/v1/catatan-tindakan', ['body' => '   '])
            ->assertUnprocessable()->assertJsonPath('errors.body.0', 'Tulis catatan tindakan.');
        $this->postJson('/api/v1/catatan-tindakan', ['body' => 'x', 'due_on' => '13/10/2026'])
            ->assertUnprocessable()->assertJsonPath('errors.due_on.0', 'Tanggal tidak valid.');
    });

    it('moves a note up and down and saves a full order', function () {
        $me = manajemenAs($this, 'direksi');
        $a = ManagementNote::factory()->ownedBy($me)->create(['body' => 'A', 'position' => 'a']);
        $b = ManagementNote::factory()->ownedBy($me)->create(['body' => 'B', 'position' => 'b']);
        $c = ManagementNote::factory()->ownedBy($me)->create(['body' => 'C', 'position' => 'c']);
        $done = ManagementNote::factory()->ownedBy($me)->done()->create(['body' => 'D']);

        $this->postJson("/api/v1/catatan-tindakan/{$c->id}/pindah", ['arah' => 'naik'])->assertOk()
            ->assertJsonPath('notes.0.body', 'A')->assertJsonPath('notes.1.body', 'C')->assertJsonPath('notes.2.body', 'B')
            ->assertJsonPath('notes.3.body', 'D');

        $this->postJson("/api/v1/catatan-tindakan/{$a->id}/pindah", ['arah' => 'turun'])->assertOk()
            ->assertJsonPath('notes.0.body', 'C')->assertJsonPath('notes.1.body', 'A');

        // Already on top: no change.
        $this->postJson("/api/v1/catatan-tindakan/{$c->id}/pindah", ['arah' => 'naik'])->assertOk()->assertJsonPath('notes.0.body', 'C');

        $this->postJson("/api/v1/catatan-tindakan/{$done->id}/pindah", ['arah' => 'naik'])->assertUnprocessable()
            ->assertJsonPath('errors.arah.0', 'Catatan yang sudah selesai tidak bisa diurutkan.');
        $this->postJson("/api/v1/catatan-tindakan/{$a->id}/pindah", ['arah' => 'samping'])->assertUnprocessable();

        $this->putJson('/api/v1/catatan-tindakan/urutan', ['ids' => [$b->id, $a->id, $c->id]])->assertNoContent();
        $this->getJson('/api/v1/catatan-tindakan')->assertJsonPath('notes.0.body', 'B')->assertJsonPath('notes.2.body', 'C');

        $this->putJson('/api/v1/catatan-tindakan/urutan', ['ids' => [$b->id, $a->id]])->assertUnprocessable()
            ->assertJsonPath('errors.ids.0', 'Daftar catatan sudah berubah. Muat ulang lalu coba lagi.');
    });

    it('hides other people\'s notes, even from Super Admin', function () {
        $note = ManagementNote::factory()->ownedBy($this->org['direksi'])->create();
        $this->org['admin']->forceFill(['two_factor_secret' => encrypt('secret'), 'two_factor_recovery_codes' => encrypt('[]'), 'two_factor_confirmed_at' => now()])->save();

        foreach (['hr', 'admin'] as $who) {
            manajemenAs($this, $who);
            $this->patchJson("/api/v1/catatan-tindakan/{$note->id}", ['done' => true])->assertNotFound();
            $this->postJson("/api/v1/catatan-tindakan/{$note->id}/pindah", ['arah' => 'naik'])->assertNotFound();
            $this->deleteJson("/api/v1/catatan-tindakan/{$note->id}")->assertNotFound();
        }

        manajemenAs($this, 'direksi');
        $this->deleteJson("/api/v1/catatan-tindakan/{$note->id}")->assertNoContent();
        expect(ManagementNote::query()->find($note->id))->toBeNull();
    });

    it('is only for management', function () {
        manajemenAs($this, 'kadiv');

        $this->getJson('/api/v1/catatan-tindakan')->assertForbidden();
        $this->postJson('/api/v1/catatan-tindakan', ['body' => 'Coba'])->assertForbidden();
        $this->putJson('/api/v1/catatan-tindakan/urutan', ['ids' => []])->assertForbidden();
    });
});
