<?php

use App\Domain\Okr\Enums\ObjectiveStatus;
use App\Models\KeyResult;
use App\Models\KeyResultCheckin;
use App\Models\Objective;
use App\Models\Task;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;

require_once __DIR__.'/../../Support/okr-helpers.php';

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-09 10:00', 'Asia/Jakarta'));
    Notification::fake();
    config(['features.okr' => true]);
    $this->w = okrWorld();
    $this->opsSpace = okrDivisionWorkspace($this->w->ops);
    $this->task = Task::factory()->create(['workspace_id' => $this->opsSpace->id, 'title' => 'Jalankan UAT sesi 3']);
});

it('answers 404 everywhere while the flag is off and hides the nav flag', function () {
    config(['features.okr' => false]);
    $kr = $this->w->keyResult;

    $this->actingAs($this->w->kadiv)->get('/okr')->assertNotFound();
    $this->actingAs($this->w->kadiv)->get('/okr/'.$this->w->objective->id)->assertNotFound();
    $this->actingAs($this->w->kadiv)->post('/okr', [])->assertNotFound();
    $this->actingAs($this->w->member)->post("/okr/kr/{$kr->id}/check-in", ['value' => 150])->assertNotFound();
    $this->actingAs($this->w->kadiv)->get('/menu')->assertInertia(fn (Assert $page) => $page->where('features.okr', false));
});

it('sends guests to the login page', function () {
    $this->get('/okr')->assertRedirect(route('login'));
});

it('lists the quarter objectives with filters and the create form options', function () {
    Objective::factory()->forDivision($this->w->prg)->ownedBy($this->w->prgKadiv)->create(['title' => 'Kualitas rilis naik']);
    Objective::factory()->forDivision($this->w->ops)->ownedBy($this->w->kadiv)->create(['quarter' => '2026-Q3', 'title' => 'Objective kuartal lalu']);

    $this->actingAs($this->w->kadiv)->get('/okr')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('okr/index')
            ->where('today', '2026-10-09')
            ->where('current_quarter', '2026-Q4')
            ->where('quarters', ['2026-Q4', '2026-Q3'])
            ->where('filters', ['quarter' => '2026-Q4', 'division' => 'all'])
            ->where('divisions', [['id' => $this->w->ops->id, 'name' => 'Operasional', 'code' => 'OPS']])
            ->has('objectives', 1)
            ->where('objectives.0.title', 'Migrasi sistem gudang tanpa insiden')
            ->where('objectives.0.status', 'active')
            ->where('objectives.0.owner', ['id' => $this->w->kadiv->id, 'name' => 'Dimas Pratama'])
            ->where('objectives.0.key_results.0.start_value', 140)
            ->where('objectives.0.key_results.0.current_value', 148)
            ->where('objectives.0.key_results.0.checkins', [])
            ->where('create.divisions.0.code', 'OPS')
            ->where('create.quarters', ['2027-Q1', '2026-Q4', '2026-Q3'])
            ->where('create.people', fn ($people) => collect($people)->pluck('name')->sort()->values()->all() === ['Dimas Pratama', 'Rizky Aditya', 'Sari Wulandari']));

    $this->actingAs($this->w->kadiv)->get('/okr?kuartal=2026-Q3')
        ->assertInertia(fn (Assert $page) => $page
            ->where('filters.quarter', '2026-Q3')
            ->where('objectives.0.title', 'Objective kuartal lalu'));

    $this->actingAs($this->w->hr)->get('/okr?divisi='.$this->w->prg->id)
        ->assertInertia(fn (Assert $page) => $page
            ->where('filters.division', $this->w->prg->id)
            ->has('divisions', 2)
            ->has('objectives', 1)
            ->where('objectives.0.title', 'Kualitas rilis naik')
            ->where('create', null));

    // A division outside the member's view is ignored, not leaked.
    $this->actingAs($this->w->member)->get('/okr?divisi='.$this->w->prg->id.'&kuartal=bukan')
        ->assertInertia(fn (Assert $page) => $page
            ->where('filters', ['quarter' => '2026-Q4', 'division' => 'all'])
            ->has('objectives', 1)
            ->where('create', null));
});

it('shows an objective with key results, check-ins, visible linked tasks and abilities', function () {
    KeyResultCheckin::factory()->for($this->w->keyResult)->create(['value' => 148, 'checked_on' => '2026-10-02', 'note' => 'Sesi 2 selesai.']);
    $hidden = Task::factory()->create(['workspace_id' => Workspace::factory()->project()->create(['division_id' => $this->w->ops->id])->id]);
    $this->w->keyResult->tasks()->attach([$this->task->id => ['created_at' => now()], $hidden->id => ['created_at' => now()]]);
    $this->task->assignees()->attach($this->w->member->id, ['assigned_at' => now()]);

    $this->actingAs($this->w->member)->get('/okr/'.$this->w->objective->id)
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('okr/show')
            ->where('today', '2026-10-09')
            ->where('objective.id', $this->w->objective->id)
            ->where('objective.division.code', 'OPS')
            ->where('objective.can', ['update' => false, 'close' => false, 'add_key_result' => false])
            ->where('objective.key_results.0.can', ['update' => true, 'checkin' => true, 'link_task' => true, 'delete' => false])
            ->where('objective.key_results.0.checkins.0.date', '2026-10-02')
            ->where('objective.key_results.0.checkins.0.author.name', 'Rizky Aditya')
            ->has('objective.key_results.0.tasks', 1)
            ->where('objective.key_results.0.tasks.0.key', $this->task->displayKey())
            ->where('objective.key_results.0.tasks.0.assignee.name', 'Rizky Aditya')
            ->where('people', fn ($people) => collect($people)->pluck('name')->contains('Sari Wulandari'))
            ->where('quarters', ['2027-Q1', '2026-Q4', '2026-Q3']));

    $this->actingAs($this->w->kadiv)->get('/okr/'.$this->w->objective->id)
        ->assertInertia(fn (Assert $page) => $page
            ->where('objective.can', ['update' => true, 'close' => true, 'add_key_result' => true])
            ->has('objective.key_results.0.tasks', 2));
});

it('hides objectives from people outside the division', function () {
    $this->actingAs($this->w->prgMember)->get('/okr/'.$this->w->objective->id)->assertNotFound();
    $this->actingAs($this->w->foreign)->get('/okr/'.$this->w->objective->id)->assertNotFound();
    $this->actingAs($this->w->prgMember)->patch('/okr/'.$this->w->objective->id, ['title' => 'x'])->assertNotFound();
    $this->actingAs($this->w->prgMember)->post("/okr/kr/{$this->w->keyResult->id}/check-in", [])->assertNotFound();
    $this->actingAs($this->w->prgMember)->get("/okr/kr/{$this->w->keyResult->id}/tugas")->assertNotFound();

    $this->w->objective->delete();
    $this->actingAs($this->w->kadiv)->get('/okr/'.$this->w->objective->id)->assertNotFound();
    $this->actingAs($this->w->kadiv)->get('/okr/bukan-ulid')->assertNotFound();
});

it('creates, edits, closes and reopens an objective', function () {
    $response = $this->actingAs($this->w->kadiv)->post('/okr', [
        'division_id' => $this->w->ops->id,
        'quarter' => '2026-Q4',
        'title' => 'Proses kerja lebih cepat',
        'description' => '',
        'owner_id' => $this->w->colleague->id,
        'status' => 'draft',
    ]);

    $objective = Objective::query()->where('title', 'Proses kerja lebih cepat')->firstOrFail();
    $response->assertRedirect('/okr/'.$objective->id);
    expect($objective)->status->toBe(ObjectiveStatus::Draft)->description->toBeNull()->owner_id->toBe($this->w->colleague->id);

    $this->actingAs($this->w->kadiv)->from('/okr/'.$objective->id)->patch('/okr/'.$objective->id, [
        'quarter' => '2026-Q4',
        'title' => 'Proses kerja internal lebih cepat',
        'description' => 'Semua tugas tercatat.',
        'owner_id' => $this->w->kadiv->id,
        'status' => 'active',
    ])->assertRedirect('/okr/'.$objective->id);

    expect($objective->fresh())->title->toBe('Proses kerja internal lebih cepat')->status->toBe(ObjectiveStatus::Active);

    $this->actingAs($this->w->direksi)->post("/okr/{$objective->id}/tutup")->assertRedirect();
    expect($objective->fresh()->status)->toBe(ObjectiveStatus::Closed);
    $this->actingAs($this->w->direksi)->post("/okr/{$objective->id}/tutup")->assertForbidden();
});

it('validates and authorizes objective forms', function () {
    $this->actingAs($this->w->kadiv)->post('/okr', [
        'division_id' => $this->w->ops->id,
        'quarter' => '2026-Q9',
        'title' => 'Ok',
        'owner_id' => $this->w->prgMember->id,
    ])->assertSessionHasErrors([
        'quarter' => 'Kuartal tidak valid.',
        'title' => 'Tulis objective minimal 5 karakter.',
        'owner_id' => 'Pemilik harus karyawan aktif atau kepala divisi ini.',
    ]);

    $valid = ['quarter' => '2026-Q4', 'title' => 'Objective baru divisi', 'owner_id' => $this->w->prgKadiv->id];

    $this->actingAs($this->w->kadiv)->post('/okr', [...$valid, 'division_id' => $this->w->prg->id])->assertForbidden();
    $this->actingAs($this->w->member)->post('/okr', [...$valid, 'division_id' => $this->w->ops->id, 'owner_id' => $this->w->member->id])->assertForbidden();
    $this->actingAs($this->w->direksi)->post('/okr', [...$valid, 'division_id' => $this->w->prg->id])->assertRedirect();
    $this->actingAs($this->w->kadiv)->post('/okr', [...$valid, 'owner_id' => $this->w->kadiv->id])->assertSessionHasErrors('division_id');
    $this->actingAs($this->w->kadiv)->patch('/okr/'.$this->w->objective->id, [...$valid, 'owner_id' => $this->w->kadiv->id, 'division_id' => $this->w->prg->id])
        ->assertSessionHasErrors('division_id');
    $this->actingAs($this->w->member)->patch('/okr/'.$this->w->objective->id, $valid)->assertForbidden();
});

it('adds, edits and removes key results', function () {
    $payload = [
        'title' => 'Bug kritis terbuka',
        'unit' => 'number',
        'unit_label' => 'bug',
        'start_value' => 2,
        'target_value' => 0,
        'current_value' => 2.5,
        'weight' => 30,
        'owner_id' => $this->w->member->id,
    ];

    $this->actingAs($this->w->kadiv)->post("/okr/{$this->w->objective->id}/kr", $payload)->assertRedirect();
    $kr = KeyResult::query()->where('title', 'Bug kritis terbuka')->firstOrFail();
    expect($kr->current_value)->toBe(2.5)->and($kr->weight)->toBe(30.0);

    $this->actingAs($this->w->member)->patch("/okr/kr/{$kr->id}", [...$payload, 'title' => 'Bug kritis di produksi'])->assertRedirect();
    expect($kr->fresh()->title)->toBe('Bug kritis di produksi');

    $this->actingAs($this->w->kadiv)->post("/okr/{$this->w->objective->id}/kr", [
        ...$payload, 'unit' => 'percent', 'start_value' => 10, 'target_value' => 120, 'weight' => 0, 'owner_id' => $this->w->prgMember->id,
    ])->assertSessionHasErrors([
        'target_value' => 'Persen harus 0–100.',
        'weight' => 'Bobot bilangan bulat 1–100.',
        'owner_id' => 'Pemilik harus karyawan aktif atau kepala divisi objective ini.',
    ]);
    $this->actingAs($this->w->kadiv)->post("/okr/{$this->w->objective->id}/kr", [...$payload, 'target_value' => 2])
        ->assertSessionHasErrors(['target_value' => 'Target harus berbeda dari nilai awal.']);

    $this->actingAs($this->w->member)->post("/okr/{$this->w->objective->id}/kr", $payload)->assertForbidden();
    $this->actingAs($this->w->member)->delete("/okr/kr/{$kr->id}")->assertForbidden();
    $this->actingAs($this->w->kadiv)->delete("/okr/kr/{$kr->id}")->assertRedirect();
    expect(KeyResult::query()->whereKey($kr->id)->exists())->toBeFalse();
});

it('records check-ins and keeps the value after a reload', function () {
    $this->actingAs($this->w->member)
        ->from('/okr/'.$this->w->objective->id)
        ->post("/okr/kr/{$this->w->keyResult->id}/check-in", ['value' => 156.5, 'confidence' => 8, 'note' => 'Sesi 3 lulus.'])
        ->assertRedirect('/okr/'.$this->w->objective->id);

    $this->actingAs($this->w->member)->get('/okr/'.$this->w->objective->id)
        ->assertInertia(fn (Assert $page) => $page
            ->where('objective.key_results.0.current_value', 156.5)
            ->where('objective.key_results.0.checkins.0.value', 156.5)
            ->where('objective.key_results.0.checkins.0.confidence', 8)
            ->where('objective.key_results.0.checkins.0.date', '2026-10-09'));

    $this->actingAs($this->w->member)->post("/okr/kr/{$this->w->keyResult->id}/check-in", ['value' => 'abc', 'confidence' => 11])
        ->assertSessionHasErrors(['value' => 'Isi nilai berupa angka.', 'confidence' => 'Keyakinan 1–10.']);
    $this->actingAs($this->w->colleague)->post("/okr/kr/{$this->w->keyResult->id}/check-in", ['value' => 1])->assertForbidden();
});

it('searches, links and unlinks division tasks', function () {
    $other = Task::factory()->create(['workspace_id' => $this->opsSpace->id, 'title' => 'Pelatihan staf gudang']);
    $foreignTask = Task::factory()->create(['workspace_id' => okrDivisionWorkspace($this->w->prg)->id, 'title' => 'Jalankan UAT aplikasi koperasi']);
    $url = "/okr/kr/{$this->w->keyResult->id}/tugas";

    $this->actingAs($this->w->member)->getJson($url.'?q=UAT')
        ->assertOk()
        ->assertJsonCount(1, 'tasks')
        ->assertJsonPath('tasks.0.id', $this->task->id)
        ->assertJsonPath('tasks.0.url', $this->task->url());

    $this->actingAs($this->w->member)->getJson($url.'?q='.$other->displayKey())->assertJsonPath('tasks.0.id', $other->id);

    $this->actingAs($this->w->member)->post($url, ['task_id' => $this->task->id])->assertRedirect()->assertSessionHasNoErrors();
    $this->actingAs($this->w->member)->post($url, ['task_id' => $foreignTask->id])->assertSessionHasErrors('task_id');
    $this->actingAs($this->w->member)->post($url, ['task_id' => '01aaaaaaaaaaaaaaaaaaaaaaaa'])->assertSessionHasErrors('task_id');
    $this->actingAs($this->w->colleague)->post($url, ['task_id' => $other->id])->assertForbidden();
    $this->actingAs($this->w->colleague)->getJson($url)->assertForbidden();

    // Already linked: not offered again.
    $this->actingAs($this->w->member)->getJson($url.'?q=UAT')->assertJsonCount(0, 'tasks');
    expect($this->w->keyResult->tasks()->pluck('tasks.id')->all())->toBe([$this->task->id]);

    $this->actingAs($this->w->member)->delete("{$url}/{$this->task->id}")->assertRedirect();
    expect($this->w->keyResult->tasks()->count())->toBe(0);
});
