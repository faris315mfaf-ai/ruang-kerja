<?php

use App\Domain\Organization\Enums\Permission;
use App\Domain\Organization\Enums\Role;
use App\Domain\Tasks\Actions\CreateTask;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Domain\Workspaces\Enums\WorkspaceVisibility;
use App\Models\Attachment;
use App\Models\ChecklistItem;
use App\Models\Comment;
use App\Models\DriveFile;
use App\Models\Label;
use App\Models\Milestone;
use App\Models\ProjectRisk;
use App\Models\ProjectUpdate;
use App\Models\SavedView;
use App\Models\Task;
use App\Models\TaskStatus;
use App\Models\User;
use App\Models\Workspace;
use Database\Seeders\RoleSeeder;
use Inertia\Testing\AssertableInertia as Assert;

require_once __DIR__.'/../../Support/project-helpers.php';

/*
 * Keputusan pemilik 6 Okt 2026: Direksi, HR and Super Admin see every shared
 * workspace (team, division, project) but, when they are not a member, only
 * look. Every mutation endpoint of a workspace and its tasks answers 403 for
 * HR and Direksi non-members; personal workspaces stay hidden (404).
 */

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->owner = User::factory()->withRole(Role::KepalaDivisi)->create();
    $this->workspace = makeProject($this->owner, ['key' => 'PRV', 'visibility' => WorkspaceVisibility::Private, 'lead_user_id' => $this->owner->id]);
    $this->member = memberWithRole($this->workspace, WorkspaceRole::Member);
    $this->task = app(CreateTask::class)->handle($this->workspace, $this->owner, ['title' => 'Landing page']);
    $this->comment = Comment::factory()->on($this->task)->by($this->member)->create();
    $this->hr = User::factory()->withRole(Role::Hr)->create(['company_id' => $this->workspace->company_id]);
    $this->direksi = User::factory()->withRole(Role::Direksi)->create(['company_id' => $this->workspace->company_id]);
});

/**
 * @return array<string, array{0: string, 1: string, 2?: array<string, mixed>}> label => [method, url, payload]
 */
function viewOnlyMutations(): array
{
    $t = test();
    $ws = $t->workspace;
    $task = $t->task;
    $status = TaskStatus::query()->where('workspace_id', $ws->id)->orderBy('position')->firstOrFail();
    $label = Label::factory()->create(['workspace_id' => $ws->id]);
    $item = ChecklistItem::query()->create(['task_id' => $task->id, 'title' => 'Cek', 'position' => 'a0']);
    $view = SavedView::factory()->shared()->create(['workspace_id' => $ws->id, 'user_id' => $t->owner->id]);
    $milestone = Milestone::factory()->create(['workspace_id' => $ws->id]);
    $risk = ProjectRisk::factory()->create(['workspace_id' => $ws->id]);
    $file = DriveFile::factory()->create(['workspace_id' => $ws->id]);
    $attachment = Attachment::factory()->create(['attachable_type' => $task->getMorphClass(), 'attachable_id' => $task->id, 'drive_file_id' => $file->id, 'uploaded_by' => $t->owner->id]);
    $update = ProjectUpdate::factory()->create(['workspace_id' => $ws->id, 'author_id' => $t->owner->id]);

    return [
        'ubah workspace' => ['patch', '/w/PRV', ['name' => 'Baru', 'visibility' => 'private']],
        'arsipkan' => ['post', '/w/PRV/arsip'],
        'favorit' => ['post', '/w/PRV/favorit'],
        'tambah anggota' => ['post', '/w/PRV/anggota', ['user_id' => $t->hr->id, 'role' => 'member']],
        'ubah peran anggota' => ['patch', "/w/PRV/anggota/{$t->member->id}", ['role' => 'viewer']],
        'keluarkan anggota' => ['delete', "/w/PRV/anggota/{$t->member->id}"],
        'kolom baru' => ['post', '/w/PRV/status', ['name' => 'QA', 'category' => 'review', 'color' => 'blue']],
        'urutan kolom' => ['put', '/w/PRV/status-urutan', ['ids' => [$status->id]]],
        'ubah kolom' => ['patch', "/w/PRV/status/{$status->id}", ['name' => 'Baru', 'category' => $status->category->value, 'color' => 'blue']],
        'hapus kolom' => ['delete', "/w/PRV/status/{$status->id}"],
        'label baru' => ['post', '/w/PRV/label', ['name' => 'Bug', 'color' => 'red']],
        'ubah label' => ['patch', "/w/PRV/label/{$label->id}", ['name' => 'Fitur', 'color' => 'blue']],
        'hapus label' => ['delete', "/w/PRV/label/{$label->id}"],
        'tugas baru' => ['post', '/w/PRV/tugas', ['title' => 'Tugas manajemen', 'status_id' => $status->id]],
        'ubah tugas' => ['patch', "/tugas/{$task->id}", ['title' => 'Diubah']],
        'pindah tugas' => ['patch', "/tugas/{$task->id}/move", ['status_id' => $status->id]],
        'hapus tugas' => ['delete', "/tugas/{$task->id}"],
        'amati tugas' => ['post', "/tugas/{$task->id}/pantau"],
        'berhenti amati' => ['delete', "/tugas/{$task->id}/pantau"],
        'checklist baru' => ['post', "/tugas/{$task->id}/checklist", ['title' => 'Langkah']],
        'centang checklist' => ['patch', "/checklist/{$item->id}", ['is_done' => true]],
        'hapus checklist' => ['delete', "/checklist/{$item->id}"],
        'komentar' => ['post', "/tugas/{$task->id}/komentar", ['body' => richDoc('Halo')]],
        'ubah komentar' => ['patch', "/komentar/{$t->comment->id}", ['body' => richDoc('Ubah')]],
        'hapus komentar' => ['delete', "/komentar/{$t->comment->id}"],
        'reaksi' => ['post', "/komentar/{$t->comment->id}/reaksi", ['emoji' => '👍']],
        'tampilan bersama' => ['post', '/w/PRV/tampilan', ['name' => 'Tim', 'layout' => 'board', 'filters' => [], 'is_shared' => true]],
        'ubah tampilan bersama' => ['patch', "/w/PRV/tampilan/{$view->id}", ['name' => 'Tim 2', 'layout' => 'board', 'filters' => [], 'is_shared' => true]],
        'hapus tampilan bersama' => ['delete', "/w/PRV/tampilan/{$view->id}"],
        'lampiran drive' => ['post', "/lampiran/task/{$task->id}/drive", ['file_ids' => ['abcdefghij12']]],
        'lampiran dokumen' => ['post', "/lampiran/task/{$task->id}/dokumen", ['type' => 'document', 'name' => 'Catatan']],
        'lepas lampiran' => ['delete', "/lampiran/{$attachment->id}"],
        'dokumen baru' => ['post', '/w/PRV/dokumen', ['type' => 'document', 'name' => 'Rencana']],
        'folder baru' => ['post', '/w/PRV/file/folder', ['name' => 'Arsip']],
        'tautkan file' => ['post', '/w/PRV/file/tautkan', ['file_ids' => ['abcdefghij12']]],
        'sinkron drive' => ['post', '/w/PRV/drive/sinkron'],
        'atribut proyek' => ['patch', '/w/PRV/proyek', ['project_status' => 'active']],
        'update proyek' => ['post', '/w/PRV/update-proyek', ['health' => 'on_track', 'summary' => 'Lancar']],
        'milestone baru' => ['post', '/w/PRV/milestone', ['name' => 'Rilis', 'target_date' => '2026-12-01']],
        'ubah milestone' => ['patch', "/w/PRV/milestone/{$milestone->id}", ['name' => 'Rilis 2', 'target_date' => '2026-12-02']],
        'selesaikan milestone' => ['patch', "/w/PRV/milestone/{$milestone->id}/selesai", ['completed' => true]],
        'hapus milestone' => ['delete', "/w/PRV/milestone/{$milestone->id}"],
        'risiko baru' => ['post', '/w/PRV/risiko', ['title' => 'Vendor telat', 'level' => 'high']],
        'ubah risiko' => ['patch', "/w/PRV/risiko/{$risk->id}", ['title' => 'Vendor', 'level' => 'low', 'status' => 'open']],
        'hapus risiko' => ['delete', "/w/PRV/risiko/{$risk->id}"],
        // Steering (PRD M10) is Direksi's — HR has no portfolio.view.
        'hr: minta update' => ['post', '/w/PRV/minta-update', ['note' => 'Tolong']],
        'hr: beri arahan' => ['post', '/w/PRV/arahan', ['body' => 'Fokus rilis']],
        'hr: keputusan selesai' => ['post', "/w/PRV/update-proyek/{$update->id}/keputusan"],
    ];
}

it('refuses every workspace and task mutation to non-member HR and Direksi', function (string $who) {
    $user = $this->{$who};
    $failures = [];

    foreach (viewOnlyMutations() as $label => $request) {
        [$method, $url] = $request;

        if ($who === 'direksi' && str_starts_with($label, 'hr:')) {
            continue;
        }

        $status = $this->actingAs($user)->withHeader('Accept', 'application/json')->json(strtoupper($method), $url, $request[2] ?? [])->status();

        if ($status !== 403) {
            $failures[] = "{$label}: {$method} {$url} → {$status}";
        }
    }

    expect($failures)->toBe([])
        ->and(Task::query()->whereKey($this->task->id)->value('title'))->toBe('Landing page')
        ->and($this->workspace->memberships()->count())->toBe(2);
})->with(['hr', 'direksi']);

it('lets HR and Direksi read every shared workspace and task, never a personal one', function (string $who) {
    $user = $this->{$who};
    $personal = Workspace::query()->where('type', 'personal')->where('owner_id', $this->member->id)->first() ?? Workspace::factory()->personal($this->member)->create();

    expect($user->hasPermission(Permission::WorkspacesViewAll))->toBeTrue();

    $this->actingAs($user)->get('/w/PRV')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->where('can.view_only', true)
        ->where('can.edit_tasks', false)
        ->where('can.manage', false)
        ->where('can.manage_members', false)
        ->where('can.favorite', false));
    $this->actingAs($user)->getJson("/tugas/{$this->task->id}")->assertOk()
        ->assertJsonPath('can.edit', false)
        ->assertJsonPath('can.comment', false)
        ->assertJsonPath('can.watch', false)
        ->assertJsonPath('can.delete', false);
    $this->actingAs($user)->get('/w/PRV/ringkasan')->assertOk();
    $this->actingAs($user)->get('/w/PRV/aktivitas')->assertOk();
    $this->actingAs($user)->get('/w/PRV/pengaturan')->assertOk();
    $this->actingAs($user)->get("/w/{$personal->key}")->assertNotFound();

    expect(Workspace::query()->visibleTo($user)->pluck('id')->all())->toContain($this->workspace->id)->not->toContain($personal->id);
})->with(['hr', 'direksi']);

it('keeps members and the Direksi steering actions working', function () {
    $this->actingAs($this->member)->postJson("/tugas/{$this->task->id}/komentar", ['body' => richDoc('Siap')])->assertCreated();
    $this->actingAs($this->member)->get('/w/PRV')->assertInertia(fn (Assert $page) => $page->where('can.view_only', false));

    // A Direksi who joins the workspace is a regular member again.
    addMember($this->workspace, $this->direksi, WorkspaceRole::Member);
    $this->actingAs($this->direksi)->postJson("/tugas/{$this->task->id}/komentar", ['body' => richDoc('Arahan')])->assertCreated();
    $this->actingAs($this->direksi)->get('/w/PRV')->assertInertia(fn (Assert $page) => $page->where('can.view_only', false)->where('can.edit_tasks', true));

    // Steering stays with Direksi as a non-member (PRD M10).
    $outside = User::factory()->withRole(Role::Direksi)->create(['company_id' => $this->workspace->company_id]);
    $this->actingAs($outside)->from('/w/PRV/ringkasan')->post('/w/PRV/arahan', ['body' => 'Percepat uji coba'])->assertRedirect('/w/PRV/ringkasan');
    expect($this->workspace->directions()->count())->toBe(1);
});

it('shows the view-only state only to management', function () {
    $outsider = User::factory()->withRole(Role::Anggota)->create(['company_id' => $this->workspace->company_id]);
    $this->workspace->update(['visibility' => WorkspaceVisibility::Internal]);

    // Internal workspace: every employee reads and comments (unchanged), management only looks.
    $this->actingAs($outsider)->get('/w/PRV')->assertInertia(fn (Assert $page) => $page->where('can.view_only', false));
    $this->actingAs($outsider)->postJson("/tugas/{$this->task->id}/komentar", ['body' => richDoc('Ikut')])->assertCreated();
    $this->actingAs($this->hr)->get('/w/PRV')->assertInertia(fn (Assert $page) => $page->where('can.view_only', true));
    $this->actingAs($this->hr)->postJson("/tugas/{$this->task->id}/komentar", ['body' => richDoc('HR')])->assertForbidden();
});
