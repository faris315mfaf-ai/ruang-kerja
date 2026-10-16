<?php

use App\Domain\Tasks\Actions\CreateTask;
use App\Domain\Workspaces\Actions\EnsurePersonalWorkspace;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;

require_once __DIR__.'/../../Support/workspace-helpers.php';

/*
| API v1 — read-only task list/detail plus the single write of Tahap 1:
| PATCH status (web MoveTask Action behind TaskPolicy::move, so an assignee
| may complete their task). Lists run through Task::visibleTo; invisible
| tasks answer 404. Writes (create/edit/delete/comment) moved to
| TaskWriteApiTest (Tahap 2, paritas fitur ponsel).
*/

if (! defined('HASH_PONSEL')) {
    define('HASH_PONSEL', 'abababababababababababababababababababababababababababababababab');
} // 64 hex (SHA-256)

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->travelTo(CarbonImmutable::parse('2026-10-06 10:00', 'Asia/Jakarta'));

    $this->viewer = User::factory()->create(['email' => 'viewer@kantor.test']);
    $this->lead = User::factory()->create();
    $this->outsider = User::factory()->create(['email' => 'outsider@kantor.test']);

    $this->personal = app(EnsurePersonalWorkspace::class)->handle($this->viewer);
    $this->team = Workspace::factory()->team()->ownedBy($this->lead)->create(['key' => 'TMS']);
    addMember($this->team, $this->viewer);

    // Pribadi (tanpa penerima) dan tim (ditugaskan ke viewer).
    $this->pribadiTask = app(CreateTask::class)->handle($this->personal, $this->viewer, ['title' => 'Susun laporan', 'due_date' => '2026-10-06']);
    $this->teamTask = app(CreateTask::class)->handle($this->team, $this->lead, ['title' => 'Deploy rilis', 'due_date' => '2026-10-06', 'assignee_ids' => [$this->viewer->id]]);
    app(CreateTask::class)->handle($this->team, $this->lead, ['title' => 'Riset besok', 'due_date' => '2026-10-07']);

    // Internal: visible to the whole company, viewer is not a member.
    $this->internal = Workspace::factory()->team()->internal()->ownedBy($this->lead)->create(['key' => 'INT']);
    $this->internalTask = app(CreateTask::class)->handle($this->internal, $this->lead, ['title' => 'Internal terbuka', 'due_date' => '2026-10-06']);

    // Workspace pribadi orang lain: tak terlihat oleh viewer.
    $otherPersonal = app(EnsurePersonalWorkspace::class)->handle($this->outsider);
    $this->invisibleTask = app(CreateTask::class)->handle($otherPersonal, $this->outsider, ['title' => 'Rahasia orang lain', 'due_date' => '2026-10-06']);
});

/**
 * Signs `email` in through the real endpoint and returns the issued token.
 */
function masukTugas(string $email): string
{
    $token = test()->postJson('/api/v1/auth/login', [
        'email' => $email,
        'password' => 'password',
        'device' => ['platform' => 'android', 'device_id_hash' => HASH_PONSEL, 'name' => 'Pixel 8'],
    ])->json('token');

    assert(is_string($token) && $token !== '');

    return $token;
}

test('hari-ini answers the three segments and the counts', function () {
    $token = masukTugas('viewer@kantor.test');

    $this->withToken($token)->getJson('/api/v1/tugas/hari-ini')
        ->assertOk()
        ->assertJsonPath('today', '2026-10-06')
        ->assertJsonPath('counts', ['pribadi' => 1, 'tim' => 1, 'semua' => 2])
        ->assertJsonPath('pribadi.0.title', 'Susun laporan')
        ->assertJsonPath('tim.0.title', 'Deploy rilis')
        ->assertJsonPath('semua.0.title', 'Susun laporan')
        ->assertJsonPath('semua.1.title', 'Deploy rilis')
        ->assertJsonPath('tim.0.key', 'TMS-1')
        ->assertJsonPath('tim.0.workspace.key', 'TMS')
        ->assertJsonPath('tim.0.status.category', 'todo')
        ->assertJsonPath('tim.0.status.is_done', false)
        ->assertJsonPath('tim.0.assignees.0', $this->viewer->name)
        ->assertJsonPath('tim.0.source', 'manual');
});

test('index lists only visible tasks, 20 per page, and saya=1 narrows to my assignments', function () {
    $token = masukTugas('viewer@kantor.test');

    $response = $this->withToken($token)->getJson('/api/v1/tugas');
    $titles = collect($response->json('tasks'))->pluck('title');

    $response->assertOk()
        ->assertJsonPath('meta.total', 4)
        ->assertJsonPath('meta.per_page', 20)
        ->assertJsonPath('meta.last_page', 1);

    // Jatuh tempo besok selalu paling akhir; urutan antara yang sama hari
    // mengikuti prioritas lalu nomor, jadi cukup periksa isinya.
    expect($titles)->toHaveCount(4)
        ->toContain('Susun laporan', 'Deploy rilis', 'Internal terbuka')
        ->and($titles->last())->toBe('Riset besok')
        ->and($titles)->not->toContain('Rahasia orang lain');

    $this->withToken($token)->getJson('/api/v1/tugas?saya=1')
        ->assertOk()
        ->assertJsonPath('meta.total', 1)
        ->assertJsonPath('tasks.0.title', 'Deploy rilis')
        ->assertJsonPath('tasks.0.assignees.0', $this->viewer->name)
        ->assertJsonMissing(['title' => 'Susun laporan']);

    // Pagination: 21 tugas lagi → dua halaman.
    foreach (range(1, 21) as $i) {
        app(CreateTask::class)->handle($this->personal, $this->viewer, ['title' => "Isi {$i}", 'due_date' => '2026-10-06']);
    }

    $this->withToken($token)->getJson('/api/v1/tugas')
        ->assertOk()
        ->assertJsonPath('meta.total', 25)
        ->assertJsonPath('meta.last_page', 2)
        ->assertJsonCount(20, 'tasks')
        ->assertJsonPath('meta.current_page', 1);

    $this->withToken($token)->getJson('/api/v1/tugas?page=2')
        ->assertOk()
        ->assertJsonPath('meta.current_page', 2)
        ->assertJsonCount(5, 'tasks');
});

test('show answers the compact detail and 404s an invisible task', function () {
    $token = masukTugas('viewer@kantor.test');

    $this->withToken($token)->getJson("/api/v1/tugas/{$this->teamTask->id}")
        ->assertOk()
        ->assertJsonPath('task.id', $this->teamTask->id)
        ->assertJsonPath('task.key', 'TMS-1')
        ->assertJsonPath('task.title', 'Deploy rilis')
        ->assertJsonPath('task.workspace.key', 'TMS')
        ->assertJsonPath('task.status.category', 'todo')
        ->assertJsonPath('task.priority.value', 0)
        ->assertJsonPath('task.priority.label', 'Tanpa')
        ->assertJsonPath('task.due_date', '2026-10-06')
        ->assertJsonPath('task.source', 'manual')
        ->assertJsonPath('task.checklist', null)
        ->assertJsonPath('task.url', '/w/TMS/tasks/1');

    $this->withToken($token)->getJson("/api/v1/tugas/{$this->invisibleTask->id}")->assertNotFound();
});

test('the assignee completes a task with done: true, reopens it, and repeats', function () {
    $token = masukTugas('viewer@kantor.test');

    // Tugas tim: "done" mengikuti aturan web (kolom Review dulu).
    $this->withToken($token)->patchJson("/api/v1/tugas/{$this->teamTask->id}/status", ['done' => true])
        ->assertOk()
        ->assertJsonPath('task.status.category', 'review')
        ->assertJsonPath('task.status.is_done', false);

    // Tugas pribadi sendiri: langsung ke kolom Selesai.
    $this->withToken($token)->patchJson("/api/v1/tugas/{$this->pribadiTask->id}/status", ['done' => true])
        ->assertOk()
        ->assertJsonPath('task.status.category', 'done')
        ->assertJsonPath('task.status.is_done', true);

    expect($this->pribadiTask->fresh()->completed_at)->not->toBeNull();

    // Buka kembali, lalu selesaikan lagi — dan tolak tugas yang sudah selesai.
    $this->withToken($token)->patchJson("/api/v1/tugas/{$this->pribadiTask->id}/status", ['done' => false])
        ->assertOk()
        ->assertJsonPath('task.status.is_done', false);

    expect($this->pribadiTask->fresh()->completed_at)->toBeNull();

    $this->withToken($token)->patchJson("/api/v1/tugas/{$this->pribadiTask->id}/status", ['done' => true])
        ->assertOk()
        ->assertJsonPath('task.status.is_done', true);

    $this->withToken($token)->patchJson("/api/v1/tugas/{$this->pribadiTask->id}/status", ['done' => true])
        ->assertUnprocessable()
        ->assertJsonPath('errors.done.0', 'Tugas ini sudah selesai.');
});

test('status_id moves to an explicit column and validates its input', function () {
    $token = masukTugas('viewer@kantor.test');
    $done = statusOf($this->team, 'done');

    $this->withToken($token)->patchJson("/api/v1/tugas/{$this->teamTask->id}/status", ['status_id' => $done->id])
        ->assertOk()
        ->assertJsonPath('task.status.id', $done->id)
        ->assertJsonPath('task.status.is_done', true);

    expect($this->teamTask->fresh()->completed_at)->not->toBeNull();

    // Kolom workspace lain tidak diterima.
    $internalDone = statusOf($this->internal, 'done');

    $this->withToken($token)->patchJson("/api/v1/tugas/{$this->teamTask->id}/status", ['status_id' => $internalDone->id])
        ->assertUnprocessable()
        ->assertJsonPath('errors.status_id.0', 'Kolom tujuan tidak ada di workspace ini.');

    // Harus memilih salah satu.
    $this->withToken($token)->patchJson("/api/v1/tugas/{$this->teamTask->id}/status", [])
        ->assertUnprocessable();

    $this->withToken($token)->patchJson("/api/v1/tugas/{$this->teamTask->id}/status", ['status_id' => $done->id, 'done' => true])
        ->assertUnprocessable()
        ->assertJsonPath('errors.status_id.0', 'Kirim status_id atau done, jangan keduanya.');
});

test('moving needs the workspace edit rights and invisibility stays a 404', function () {
    $token = masukTugas('viewer@kantor.test');

    // Workspace internal terlihat, tapi viewer bukan anggota → 403, bukan 404.
    $this->withToken($token)->patchJson("/api/v1/tugas/{$this->internalTask->id}/status", ['done' => true])
        ->assertForbidden();

    // Tugas yang tak terlihat → 404 sebelum validasi.
    $this->withToken($token)->patchJson("/api/v1/tugas/{$this->invisibleTask->id}/status", ['done' => true])
        ->assertNotFound();

    expect($this->internalTask->fresh()->status_category->value)->toBe('todo')
        ->and($this->invisibleTask->fresh()->status_category->value)->toBe('todo');
});

test('task endpoints reject requests without a token', function () {
    $this->getJson('/api/v1/tugas/hari-ini')->assertUnauthorized();
    $this->getJson('/api/v1/tugas')->assertUnauthorized();
    $this->getJson("/api/v1/tugas/{$this->teamTask->id}")->assertUnauthorized();
    $this->patchJson("/api/v1/tugas/{$this->teamTask->id}/status", ['done' => true])->assertUnauthorized();
});
