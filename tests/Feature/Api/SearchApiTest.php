<?php

use App\Domain\Meetings\Enums\Recurrence;
use App\Domain\Organization\Enums\Role;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Models\Meeting;
use App\Models\Note;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Laravel\Sanctum\Sanctum;
use Tests\Support\RequestScenario;

require_once __DIR__.'/../../Support/workspace-helpers.php';

/*
| API v1 — GET /cari: pencarian global untuk aplikasi. Provider web yang sama
| (penyaring visibleTo di tiap provider), kecuali grup "Aksi" (khusus klien web);
| tiap hasil membawa `target` agar aplikasi tidak mem-parsing URL.
*/

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    config(['features.meetings' => true, 'features.notes' => true]);
    $this->travelTo(CarbonImmutable::parse('2026-10-05 08:00', 'Asia/Jakarta'));

    $this->dimas = User::factory()->withRole(Role::KepalaDivisi)->create(['name' => 'Dimas Pratama']);
    $this->rizky = User::factory()->withRole(Role::Anggota)->create(['name' => 'Rizky Pelaksana']);
    $this->outsider = User::factory()->withRole(Role::Anggota)->create(['name' => 'Orang Luar']);

    $this->workspace = Workspace::factory()->ownedBy($this->dimas)->create(['key' => 'PLQ', 'name' => 'Proyek Peluncuran']);
    addMember($this->workspace, $this->rizky, WorkspaceRole::Member);
    $this->task = Task::factory()->create(['workspace_id' => $this->workspace->id, 'title' => 'Landing peluncuran produk']);

    $this->rapat = Meeting::factory()->by($this->dimas)->at('2026-10-06 10:00')
        ->withParticipants([$this->rizky])->create(['title' => 'Koordinasi peluncuran', 'agenda' => ['Jadwal rilis']]);

    Sanctum::actingAs($this->rizky);
});

test('q is required with at least two characters', function () {
    $this->getJson('/api/v1/cari')->assertUnprocessable()->assertJsonPath('errors.q.0', 'Ketik minimal 2 huruf untuk mencari.');
    $this->getJson('/api/v1/cari?q=a')->assertUnprocessable()->assertJsonValidationErrors(['q']);
    $this->getJson('/api/v1/cari?q=peluncuran&tipe=semua')->assertUnprocessable()->assertJsonValidationErrors(['tipe']);
});

test('results are grouped with Indonesian keys, targets and no web actions group', function () {
    $response = $this->getJson('/api/v1/cari?q=peluncuran')->assertOk();
    $groups = collect($response->json('groups'))->keyBy('key');

    expect($groups->keys()->all())->toContain('tugas', 'workspace', 'rapat')
        ->not->toContain('actions')
        ->and($groups['tugas']['items'][0]['target'])->toBe(['type' => 'tugas', 'id' => $this->task->id, 'anchor' => null, 'params' => []])
        ->and($groups['workspace']['items'][0]['target']['id'])->toBe($this->workspace->id)
        ->and($groups['rapat']['label'])->toBe('Rapat')
        ->and($groups['rapat']['items'][0]['title'])->toBe('Koordinasi peluncuran')
        ->and($groups['rapat']['items'][0]['target'])->toBe(['type' => 'rapat', 'id' => $this->rapat->id, 'anchor' => null, 'params' => []])
        ->and($groups['rapat']['has_more'])->toBeFalse();

    $response->assertJsonPath('q', 'peluncuran')->assertJsonPath('terms', ['peluncuran']);
});

test('tipe narrows to one group with a bigger page and has_more', function () {
    foreach (range(1, 6) as $n) {
        Task::factory()->create(['workspace_id' => $this->workspace->id, 'title' => "Rencana kampanye {$n}"]);
    }

    $all = $this->getJson('/api/v1/cari?q=kampanye')->assertOk();
    $tasks = collect($all->json('groups'))->firstWhere('key', 'tugas');

    expect($tasks['items'])->toHaveCount(5)->and($tasks['has_more'])->toBeTrue();

    $only = $this->getJson('/api/v1/cari?q=kampanye&tipe=tugas')->assertOk();

    expect(collect($only->json('groups'))->pluck('key')->all())->toBe(['tugas'])
        ->and($only->json('groups.0.items'))->toHaveCount(6)
        ->and($only->json('groups.0.has_more'))->toBeFalse();
});

test('people, notes and requests carry typed targets', function () {
    $note = Note::factory()->in($this->workspace)->create(['title' => 'Notulen peluncuran']);

    $groups = collect($this->getJson('/api/v1/cari?q=peluncuran')->json('groups'))->keyBy('key');

    expect($groups['catatan']['items'][0]['target'])->toBe(['type' => 'catatan', 'id' => $note->id, 'anchor' => null, 'params' => []]);

    // Staff only find themselves (+ direct reports): User::visibleTo.
    $people = collect($this->getJson('/api/v1/cari?q=Rizky')->json('groups'))->firstWhere('key', 'orang');

    expect($people['items'][0]['target']['type'])->toBe('orang')
        ->and($people['items'][0]['target']['id'])->toBe($this->rizky->id);
});

test('visibility is enforced: personal workspaces, others meetings and requests never leak', function () {
    $personal = Workspace::query()->where('type', 'personal')->where('owner_id', $this->dimas->id)->firstOrFail();
    Task::factory()->create(['workspace_id' => $personal->id, 'title' => 'Rahasia pribadi Dimas']);
    Meeting::factory()->by($this->dimas)->at('2026-10-07 09:00')->create(['title' => 'Rapat tertutup pimpinan']);

    // Rizky (not invited, not in the personal workspace) finds neither.
    expect($this->getJson('/api/v1/cari?q=rahasia')->assertOk()->json('groups'))->toBe([])
        ->and($this->getJson('/api/v1/cari?q=tertutup')->assertOk()->json('groups'))->toBe([]);

    // A stranger finds nothing of the workspace either.
    Sanctum::actingAs($this->outsider);
    expect($this->getJson('/api/v1/cari?q=peluncuran')->assertOk()->json('groups'))->toBe([]);

    // The owner finds their own private task and meeting.
    Sanctum::actingAs($this->dimas);
    expect(collect($this->getJson('/api/v1/cari?q=rahasia')->json('groups'))->pluck('key')->all())->toBe(['tugas'])
        ->and(collect($this->getJson('/api/v1/cari?q=tertutup')->json('groups'))->pluck('key')->all())->toBe(['rapat']);
});

test('search requires a token', function () {
    $this->refreshApplication();
    $this->getJson('/api/v1/cari?q=peluncuran')->assertUnauthorized();
});

test('recurring and canceled meetings: series are labelled, canceled ones are not listed', function () {
    Meeting::factory()->by($this->dimas)->at('2026-10-05 09:00', 30)->recurring(Recurrence::MonWedFri, '2026-12-31')
        ->withParticipants([$this->rizky])->create(['title' => 'Stand-up harian']);
    Meeting::factory()->by($this->dimas)->at('2026-10-08 09:00')->withParticipants([$this->rizky])
        ->create(['title' => 'Stand-up dibatalkan', 'canceled_at' => now()]);

    $items = collect($this->getJson('/api/v1/cari?q=stand-up&tipe=rapat')->assertOk()->json('groups.0.items'));

    expect($items->pluck('title')->all())->toBe(['Stand-up harian'])
        ->and($items[0]['subtitle'])->toContain('Senin, Rabu, Jumat');
});

test('requests open the pengajuan screen for the owner and the persetujuan screen for the approver', function () {
    $scenario = RequestScenario::make();
    $request = $scenario->submit($scenario->employee, $scenario->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-13', 'reason' => 'Acara keluarga di Solo']);

    Sanctum::actingAs($scenario->employee);
    $own = $this->getJson('/api/v1/cari?q=solo')->assertOk()->json('groups.0');

    expect($own['key'])->toBe('pengajuan')
        ->and($own['items'][0]['target'])->toBe(['type' => 'pengajuan', 'id' => $request->id, 'anchor' => null, 'params' => []]);

    Sanctum::actingAs($scenario->manager);
    $toDecide = $this->getJson('/api/v1/cari?q='.rawurlencode($scenario->employee->name))->assertOk();
    $group = collect($toDecide->json('groups'))->firstWhere('key', 'pengajuan');

    expect($group['items'][0]['target']['type'])->toBe('persetujuan')
        ->and($group['items'][0]['target']['id'])->toBe($request->id);
});
