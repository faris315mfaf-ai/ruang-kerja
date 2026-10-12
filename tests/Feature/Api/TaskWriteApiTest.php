<?php

use App\Domain\Tasks\Actions\CreateTask;
use App\Domain\Tasks\Actions\PostComment;
use App\Domain\Tasks\Actions\UpdateTask;
use App\Domain\Tasks\Notifications\TaskCommentedNotification;
use App\Domain\Workspaces\Actions\EnsurePersonalWorkspace;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Contracts\Auth\Factory;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

require_once __DIR__.'/../../Support/workspace-helpers.php';

/*
| API v1 — task writes (Tahap 2, paritas fitur): create/edit/delete behind
| the web Actions and policies, comments as plain text (stored as the same
| Tiptap document as the web, so watcher notifications still run) and the
| workspace board. The edit/delete matrix is the owner's 9 Oct 2026 rule:
| a task assigned by someone else is only editable by its creator or a
| superior (workspace admin/owner or the direct manager of an assignee).
*/

if (! defined('HASH_PONSEL')) {
    define('HASH_PONSEL', str_repeat('ab', 32));
} // 64 hex (SHA-256)

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->travelTo(CarbonImmutable::parse('2026-10-10 09:00', 'Asia/Jakarta'));
    Notification::fake();

    $this->lead = User::factory()->create(['name' => 'Nadia Pemimpin']);
    $this->manager = User::factory()->create(['name' => 'Rudi Manajer']);
    $this->viewer = User::factory()->managedBy($this->manager)->create(['name' => 'Rizky Staf', 'email' => 'viewer@kantor.test']);
    $this->colleague = User::factory()->create(['name' => 'Sari Rekan']);
    $this->admin = User::factory()->create(['name' => 'Beni Admin']);
    $this->outsider = User::factory()->create(['email' => 'outsider@kantor.test']);

    $this->personal = app(EnsurePersonalWorkspace::class)->handle($this->viewer);
    $this->team = Workspace::factory()->team()->ownedBy($this->lead)->create(['key' => 'TMS']);
    addMember($this->team, $this->viewer);
    addMember($this->team, $this->manager);
    addMember($this->team, $this->colleague);
    addMember($this->team, $this->admin, WorkspaceRole::Admin);

    // Tugas titipan: dibuat lead, diterima viewer (atasan langsung = manager).
    $this->assigned = app(CreateTask::class)->handle($this->team, $this->lead, [
        'title' => 'Deploy rilis',
        'due_date' => '2026-10-10',
        'assignee_ids' => [$this->viewer->id],
    ]);
    // Tugas tim sendiri (pembuat = viewer) dan tugas pribadi.
    $this->ownTeam = app(CreateTask::class)->handle($this->team, $this->viewer, ['title' => 'Tugas tim sendiri']);
    $this->ownPersonal = app(CreateTask::class)->handle($this->personal, $this->viewer, ['title' => 'Catatan pribadi']);

    $otherPersonal = app(EnsurePersonalWorkspace::class)->handle($this->outsider);
    $this->invisible = app(CreateTask::class)->handle($otherPersonal, $this->outsider, ['title' => 'Rahasia orang lain']);

    // Internal: terlihat seluruh karyawan, viewer bukan anggota.
    $this->internal = Workspace::factory()->team()->internal()->ownedBy($this->lead)->create(['key' => 'INT']);
});

/**
 * Signs `email` in through the real endpoint and returns the issued token.
 */
function masukTulis(string $email): string
{
    $token = test()->postJson('/api/v1/auth/login', [
        'email' => $email,
        'password' => 'password',
        'device' => ['platform' => 'android', 'device_id_hash' => HASH_PONSEL, 'name' => 'Pixel 8'],
    ])->json('token');

    assert(is_string($token) && $token !== '');

    return $token;
}

/**
 * Calls as a (different) token: the sanctum guard caches its user between
 * requests of one test, so switching tokens drops the cached guards first
 * (see AuthApiTest::sebagaiToken).
 */
function sebagaiTokenTulis(string $token): TestCase
{
    app(Factory::class)->forgetGuards();

    return test()->withToken($token);
}

test('a member creates a task with the web numbering, column and response shape', function () {
    $token = masukTulis('viewer@kantor.test');

    $this->withToken($token)->postJson('/api/v1/tugas', [
        'workspace_id' => $this->team->id,
        'title' => 'Susun laporan mingguan',
        'description' => "Baris pertama.\nBaris kedua.",
        'assignee_ids' => [$this->colleague->id],
        'due_date' => '2026-10-12',
        'priority' => 2,
    ])->assertCreated()
        ->assertJsonPath('task.key', 'TMS-3')
        ->assertJsonPath('task.title', 'Susun laporan mingguan')
        ->assertJsonPath('task.workspace.key', 'TMS')
        ->assertJsonPath('task.status.category', 'todo')
        ->assertJsonPath('task.priority.value', 2)
        ->assertJsonPath('task.due_date', '2026-10-12')
        ->assertJsonPath('task.description_text', "Baris pertama.\nBaris kedua.")
        ->assertJsonPath('task.assignees.0', 'Sari Rekan');

    $task = $this->team->fresh()->tasks()->where('number', 3)->firstOrFail();

    expect($task->created_by)->toBe($this->viewer->id)
        ->and($task->assignees->pluck('id')->all())->toBe([$this->colleague->id]);
});

test('create refuses an invisible workspace (404), a viewer (403) and a non-member assignee (422)', function () {
    $token = masukTulis('viewer@kantor.test');

    // Workspace pribadi orang lain tidak pernah terungkap.
    $this->withToken($token)->postJson('/api/v1/tugas', [
        'workspace_id' => app(EnsurePersonalWorkspace::class)->handle($this->outsider)->id,
        'title' => 'Menyusup',
    ])->assertNotFound();

    // Internal terlihat, tetapi viewer bukan anggota → 403, bukan 404.
    $this->withToken($token)->postJson('/api/v1/tugas', [
        'workspace_id' => $this->internal->id,
        'title' => 'Coba internal',
    ])->assertForbidden();

    // Penerima harus anggota workspace target (kunci galat "assignee_ids.0").
    $response = $this->withToken($token)->postJson('/api/v1/tugas', [
        'workspace_id' => $this->team->id,
        'title' => 'Salah penerima',
        'assignee_ids' => [$this->outsider->id],
    ]);

    $response->assertUnprocessable();
    expect($response->json('errors'))->toBe(['assignee_ids.0' => ['Penanggung jawab harus anggota workspace.']]);

    // Judul wajib.
    $this->withToken($token)->postJson('/api/v1/tugas', ['workspace_id' => $this->team->id])
        ->assertUnprocessable()
        ->assertJsonPath('errors.title.0', 'Judul tugas wajib diisi.');

    expect($this->team->fresh()->tasks()->count())->toBe(2);
});

test('the 9 Oct edit matrix: creator and superiors may edit; the assignee and bystanders may not', function () {
    // Pembuat (lead) boleh.
    $lead = masukTulis($this->lead->email);
    sebagaiTokenTulis($lead)->patchJson("/api/v1/tugas/{$this->assigned->id}", ['title' => 'Revisi lead'])
        ->assertOk()->assertJsonPath('task.title', 'Revisi lead');

    // Atasan langsung penerima (manager_id) boleh, walau bukan anggota.
    $manager = masukTulis($this->manager->email);
    sebagaiTokenTulis($manager)->patchJson("/api/v1/tugas/{$this->assigned->id}", ['priority' => 1])
        ->assertOk()->assertJsonPath('task.priority.value', 1);

    // Penerima tugas titipan tidak boleh (aturan 9 Okt).
    $viewer = masukTulis('viewer@kantor.test');
    sebagaiTokenTulis($viewer)->patchJson("/api/v1/tugas/{$this->assigned->id}", ['title' => 'Coba penerima'])
        ->assertForbidden()
        ->assertJsonPath('message', 'Tugas yang ditugaskan orang lain hanya dapat diubah atau dihapus oleh pembuatnya atau atasan.');

    // Anggota lain (bukan pembuat/atasan/penerima) juga tidak boleh: tugas
    // titipan milik pembuatnya.
    $colleague = masukTulis($this->colleague->email);
    sebagaiTokenTulis($colleague)->patchJson("/api/v1/tugas/{$this->assigned->id}", ['title' => 'Revisi rekan'])
        ->assertForbidden()
        ->assertJsonPath('message', 'Tugas yang ditugaskan orang lain hanya dapat diubah atau dihapus oleh pembuatnya atau atasan.');

    // Pribadi sendiri bebas; tugas orang luar tidak pernah terungkap.
    sebagaiTokenTulis($viewer)->patchJson("/api/v1/tugas/{$this->ownPersonal->id}", ['title' => 'Pribadi baru'])
        ->assertOk();

    sebagaiTokenTulis($viewer)->patchJson("/api/v1/tugas/{$this->invisible->id}", ['title' => 'Suntik'])
        ->assertNotFound();

    // PATCH kosong tidak mengubah apa pun.
    sebagaiTokenTulis($viewer)->patchJson("/api/v1/tugas/{$this->ownTeam->id}", [])
        ->assertOk()->assertJsonPath('task.title', 'Tugas tim sendiri');

    // Validasi: tenggat salah format.
    sebagaiTokenTulis($viewer)->patchJson("/api/v1/tugas/{$this->ownTeam->id}", ['due_date' => '10/10/2026'])
        ->assertUnprocessable()
        ->assertJsonPath('errors.due_date.0', 'Tenggat tidak valid.');
});

test('the 9 Oct delete matrix', function () {
    $lead = masukTulis($this->lead->email);
    $viewer = masukTulis('viewer@kantor.test');
    $admin = masukTulis($this->admin->email);
    $colleague = masukTulis($this->colleague->email);

    // Penerima tugas titipan tidak boleh menghapus.
    sebagaiTokenTulis($viewer)->deleteJson("/api/v1/tugas/{$this->assigned->id}")
        ->assertForbidden()
        ->assertJsonPath('message', 'Tugas yang ditugaskan orang lain hanya dapat diubah atau dihapus oleh pembuatnya atau atasan.');

    // Anggota biasa bukan pembuat juga tidak.
    sebagaiTokenTulis($colleague)->deleteJson("/api/v1/tugas/{$this->assigned->id}")
        ->assertForbidden()
        ->assertJsonPath('message', 'Tugas yang ditugaskan orang lain hanya dapat diubah atau dihapus oleh pembuatnya atau atasan.');

    // Tanpa penerima: tetap aturan hapus lama (pembuat/admin).
    sebagaiTokenTulis($colleague)->deleteJson("/api/v1/tugas/{$this->ownTeam->id}")
        ->assertForbidden()
        ->assertJsonPath('message', 'Hanya pembuat tugas atau admin workspace yang dapat menghapus.');

    // Admin workspace boleh; pembuat boleh; tak terlihat 404.
    sebagaiTokenTulis($admin)->deleteJson("/api/v1/tugas/{$this->assigned->id}")->assertNoContent();
    expect($this->assigned->fresh()->deleted_at)->not->toBeNull();

    sebagaiTokenTulis($lead)->deleteJson("/api/v1/tugas/{$this->ownTeam->id}")->assertNoContent();
    sebagaiTokenTulis($viewer)->deleteJson("/api/v1/tugas/{$this->ownPersonal->id}")->assertNoContent();
    sebagaiTokenTulis($viewer)->deleteJson("/api/v1/tugas/{$this->invisible->id}")->assertNotFound();
});

test('a plain-text comment is stored like the web and notifies the watchers', function () {
    $token = masukTulis('viewer@kantor.test');

    $response = $this->withToken($token)->postJson("/api/v1/tugas/{$this->assigned->id}/komentar", [
        'body' => 'Deploy ke produksi sore ini.',
    ])->assertCreated();

    $comment = $response->json('comment');

    expect($comment['body_text'])->toBe('Deploy ke produksi sore ini.')
        ->and($comment['author']['id'])->toBe($this->viewer->id)
        ->and($comment['body']['type'])->toBe('doc');

    // Pembuat tugas mengikuti (watcher) → notifikasi "mengomentari".
    Notification::assertSentTo($this->lead, TaskCommentedNotification::class);
    Notification::assertNotSentTo($this->viewer, TaskCommentedNotification::class);

    // Komentar kosong ditolak; tugas tak terlihat 404.
    $this->withToken($token)->postJson("/api/v1/tugas/{$this->assigned->id}/komentar", ['body' => '   '])
        ->assertUnprocessable()
        ->assertJsonPath('errors.body.0', 'Komentar tidak boleh kosong.');

    $this->withToken($token)->postJson("/api/v1/tugas/{$this->invisible->id}/komentar", ['body' => 'Halo'])
        ->assertNotFound();
});

test('comments list is paginated 30, newest first', function () {
    $token = masukTulis('viewer@kantor.test');

    foreach (range(1, 32) as $i) {
        app(PostComment::class)->handle($this->assigned, $this->viewer, ['type' => 'doc', 'content' => [
            ['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => "Komentar {$i}"]]],
        ]]);
    }

    $response = $this->withToken($token)->getJson("/api/v1/tugas/{$this->assigned->id}/komentar");

    $response->assertOk()
        ->assertJsonPath('meta.total', 32)
        ->assertJsonPath('meta.per_page', 30)
        ->assertJsonPath('meta.last_page', 2)
        ->assertJsonCount(30, 'comments')
        ->assertJsonPath('comments.0.body_text', 'Komentar 32');

    $this->withToken($token)->getJson("/api/v1/tugas/{$this->assigned->id}/komentar?page=2")
        ->assertOk()
        ->assertJsonCount(2, 'comments')
        ->assertJsonPath('comments.0.body_text', 'Komentar 2');

    // Tugas tak terlihat → 404.
    $this->withToken($token)->getJson("/api/v1/tugas/{$this->invisible->id}/komentar")->assertNotFound();
});

test('the board answers columns with cards and hides invisible workspaces', function () {
    $token = masukTulis('viewer@kantor.test');

    $response = $this->withToken($token)->getJson('/api/v1/workspace/TMS/papan');

    $response->assertOk()
        ->assertJsonPath('workspace.key', 'TMS')
        ->assertJsonPath('hidden_closed_count', 0);

    $columns = collect($response->json('columns'));
    $todo = $columns->firstWhere('kategori', 'todo');

    expect($todo)->not->toBeNull()
        ->and($todo['name'])->toBeString()
        ->and($columns->pluck('kategori')->unique()->all())->toContain('done')
        ->and(count($todo['tasks']))->toBe(2);

    $card = collect($todo['tasks'])->firstWhere('key', 'TMS-1');

    expect($card['title'])->toBe('Deploy rilis')
        ->and($card['status_category'])->toBe('todo')
        ->and($card['assignee_ids'])->toBe([$this->viewer->id])
        ->and($card['comments'])->toBe(['count' => 0, 'unread' => false])
        ->and($card['checklist'])->toBeNull();

    // Workspace pribadi orang lain tidak pernah terungkap (binder → 404).
    $this->withToken($token)->getJson('/api/v1/workspace/'.app(EnsurePersonalWorkspace::class)->handle($this->outsider)->id.'/papan')
        ->assertNotFound();
});

test('task write endpoints reject requests without a token', function () {
    $this->postJson('/api/v1/tugas', ['workspace_id' => $this->team->id, 'title' => 'X'])->assertUnauthorized();
    $this->patchJson("/api/v1/tugas/{$this->assigned->id}", ['title' => 'X'])->assertUnauthorized();
    $this->deleteJson("/api/v1/tugas/{$this->assigned->id}")->assertUnauthorized();
    $this->postJson("/api/v1/tugas/{$this->assigned->id}/komentar", ['body' => 'X'])->assertUnauthorized();
    $this->getJson("/api/v1/tugas/{$this->assigned->id}/komentar")->assertUnauthorized();
    $this->getJson('/api/v1/workspace/TMS/papan')->assertUnauthorized();
});
it('exposes assignee names on board cards, workspace members, and can flags on the detail', function () {
    $token = masukTulis('viewer@kantor.test');
    $workspace = $this->team;
    $task = app(CreateTask::class)->handle($workspace, $this->lead, ['title' => 'Kartu uji', 'assignee_ids' => [$this->colleague->id]]);

    $papan = sebagaiTokenTulis($token)->getJson('/api/v1/workspace/'.$workspace->id.'/papan')->assertOk()->json('columns');
    $kartu = collect($papan)->flatMap(fn ($c) => $c['tasks'])->firstWhere('id', $task->id);
    expect($kartu['assignees'])->toBe([['id' => $this->colleague->id, 'nama' => 'Sari Rekan']]);

    sebagaiTokenTulis($token)->getJson('/api/v1/workspace/'.$workspace->id.'/anggota')
        ->assertOk()
        ->assertJsonStructure(['anggota' => [['id', 'name', 'role']]]);

    // Viewer only receives this task (created by the lead): can work, cannot edit.
    $tokenViewer = masukTulis('viewer@kantor.test');
    sebagaiTokenTulis($tokenViewer)->getJson('/api/v1/tugas/'.$task->id)
        ->assertOk()
        ->assertJsonPath('task.can.comment', true);
});

test('PATCH answers the same can flags as the detail', function () {
    $lead = masukTulis($this->lead->email);

    sebagaiTokenTulis($lead)->patchJson("/api/v1/tugas/{$this->assigned->id}", ['title' => 'Revisi'])
        ->assertOk()
        ->assertJsonPath('task.can', ['edit' => true, 'work' => true, 'delete' => true, 'comment' => true]);

    // Assigning a colleague to the viewer's own team task keeps it editable
    // for its creator, and the flags follow the new assignment.
    $viewer = masukTulis('viewer@kantor.test');
    sebagaiTokenTulis($viewer)->patchJson("/api/v1/tugas/{$this->ownTeam->id}", ['assignee_ids' => [$this->colleague->id]])
        ->assertOk()
        ->assertJsonPath('task.can.edit', true)
        ->assertJsonPath('task.can.delete', true);

    // The detail of the assigned task: the assignee works but cannot edit.
    sebagaiTokenTulis($viewer)->getJson("/api/v1/tugas/{$this->assigned->id}")
        ->assertOk()
        ->assertJsonPath('task.can', ['edit' => false, 'work' => true, 'delete' => false, 'comment' => true]);
});

test('create accepts the canonical uppercase workspace ULID', function () {
    $token = masukTulis('viewer@kantor.test');

    $this->withToken($token)->postJson('/api/v1/tugas', [
        'workspace_id' => strtoupper($this->team->id),
        'title' => 'Dari ULID kapital',
        'assignee_ids' => [$this->colleague->id],
    ])->assertCreated()
        ->assertJsonPath('task.workspace.key', 'TMS')
        ->assertJsonPath('task.assignees.0', 'Sari Rekan');
});

test('a PATCH with the unchanged plain text keeps a rich description', function () {
    $lead = masukTulis($this->lead->email);
    $rich = ['type' => 'doc', 'content' => [
        ['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => 'Penting', 'marks' => [['type' => 'bold']]]]],
        ['type' => 'bulletList', 'content' => [['type' => 'listItem', 'content' => [
            ['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => 'Poin satu']]],
        ]]]],
    ]];
    app(UpdateTask::class)->handle($this->assigned, $this->lead, ['description' => $rich]);
    $text = $this->assigned->fresh()->description_text;
    $document = $this->assigned->fresh()->description;

    sebagaiTokenTulis($lead)->patchJson("/api/v1/tugas/{$this->assigned->id}", ['title' => 'Judul baru', 'description' => $text])
        ->assertOk();

    expect($this->assigned->fresh()->description)->toBe($document);

    // A real change of the text still rebuilds the document from plain text.
    sebagaiTokenTulis($lead)->patchJson("/api/v1/tugas/{$this->assigned->id}", ['description' => 'Teks baru'])
        ->assertOk()
        ->assertJsonPath('task.description_text', 'Teks baru');
});

test('the task list holds open and recently completed tasks with a stable order', function () {
    $token = masukTulis('viewer@kantor.test');

    // Completed long ago: not in the list; completed this week: still listed.
    $old = app(CreateTask::class)->handle($this->team, $this->viewer, ['title' => 'Selesai lama', 'assignee_ids' => [$this->viewer->id]]);
    $old->forceFill(['status_category' => 'done', 'completed_at' => now()->subWeeks(3)])->save();
    $recent = app(CreateTask::class)->handle($this->team, $this->viewer, ['title' => 'Selesai minggu ini', 'assignee_ids' => [$this->viewer->id]]);
    $recent->forceFill(['status_category' => 'done', 'completed_at' => now()->subHour()])->save();

    $all = collect($this->withToken($token)->getJson('/api/v1/tugas')->assertOk()->json('tasks'))->pluck('id');
    $mine = collect($this->withToken($token)->getJson('/api/v1/tugas?saya=1')->assertOk()->json('tasks'))->pluck('id');

    expect($all)->not->toContain($old->id)
        ->and($all)->toContain($recent->id)
        ->and($mine)->not->toContain($old->id)
        ->and($mine)->toContain($recent->id)
        ->and($mine)->toContain($this->assigned->id)
        ->and($mine)->not->toContain($this->ownTeam->id);
});
