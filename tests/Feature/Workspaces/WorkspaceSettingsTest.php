<?php

use App\Domain\Organization\Enums\Role;
use App\Domain\Tasks\Actions\CreateTask;
use App\Domain\Tasks\Enums\TaskStatusCategory;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Events\Workspaces\WorkspaceMembersChanged;
use App\Models\AuditLog;
use App\Models\Label;
use App\Models\TaskStatus;
use App\Models\User;
use App\Models\Workspace;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Event;

require_once __DIR__.'/../../Support/workspace-helpers.php';

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->owner = User::factory()->withRole(Role::KepalaDivisi)->create();
    $this->workspace = Workspace::factory()->ownedBy($this->owner)->create(['key' => 'PLQ', 'name' => 'Proyek Peluncuran Q4']);
});

it('updates the general settings and keeps old keys redirecting', function () {
    $this->actingAs($this->owner)
        ->patch('/w/PLQ', ['name' => 'Peluncuran Q4', 'key' => 'plq4', 'visibility' => 'internal', 'description' => 'Koordinasi lintas divisi'])
        ->assertRedirect('/w/PLQ4/pengaturan')
        ->assertSessionHasNoErrors();

    $workspace = $this->workspace->fresh();

    expect($workspace->name)->toBe('Peluncuran Q4')
        ->and($workspace->key)->toBe('PLQ4')
        ->and($workspace->previous_keys)->toBe(['PLQ'])
        ->and($workspace->visibility->value)->toBe('internal');

    $this->actingAs($this->owner)->get('/w/PLQ/pengaturan?tab=anggota')->assertRedirect('/w/PLQ4/pengaturan?tab=anggota')->assertStatus(301);
    $this->actingAs($this->owner)->get('/w/plq4')->assertRedirect('/w/PLQ4');
});

it('rejects keys that are invalid or already used', function () {
    Workspace::factory()->ownedBy($this->owner)->create(['key' => 'OPS']);

    $this->actingAs($this->owner)->patch('/w/PLQ', ['key' => 'OPS'])->assertSessionHasErrors(['key' => 'Key OPS sudah dipakai workspace lain.']);
    $this->actingAs($this->owner)->patch('/w/PLQ', ['key' => '1X'])->assertSessionHasErrors('key');
});

it('lets admins manage members and forbids members and viewers', function () {
    Event::fake([WorkspaceMembersChanged::class]);
    $admin = memberWithRole($this->workspace, WorkspaceRole::Admin);
    $member = memberWithRole($this->workspace, WorkspaceRole::Member);
    $newcomer = User::factory()->create();

    $this->actingAs($member)->post('/w/PLQ/anggota', ['user_id' => $newcomer->id, 'role' => 'member'])->assertForbidden();

    $this->actingAs($admin)->post('/w/PLQ/anggota', ['user_id' => $newcomer->id, 'role' => 'viewer'])->assertRedirect('/w/PLQ/pengaturan');
    expect($this->workspace->roleOf($newcomer))->toBe(WorkspaceRole::Viewer);

    $this->actingAs($admin)->patch("/w/PLQ/anggota/{$newcomer->id}", ['role' => 'member'])->assertRedirect();
    expect($this->workspace->roleOf($newcomer))->toBe(WorkspaceRole::Member)
        ->and(AuditLog::query()->where('action', 'workspace.member_role_changed')->count())->toBe(1);

    $this->actingAs($admin)->delete("/w/PLQ/anggota/{$newcomer->id}")->assertRedirect();
    expect($this->workspace->roleOf($newcomer))->toBeNull();

    Event::assertDispatchedTimes(WorkspaceMembersChanged::class, 3);
});

it('protects the owner, synced members and duplicate invites', function () {
    $synced = addMember($this->workspace, User::factory()->create(), WorkspaceRole::Member, synced: true);
    $existing = memberWithRole($this->workspace, WorkspaceRole::Member);

    $this->actingAs($this->owner)->delete("/w/PLQ/anggota/{$this->owner->id}")->assertSessionHasErrors(['user_id' => 'Owner tidak dapat dikeluarkan.']);
    $this->actingAs($this->owner)->delete("/w/PLQ/anggota/{$synced->id}")->assertSessionHasErrors('user_id');
    $this->actingAs($this->owner)->patch("/w/PLQ/anggota/{$this->owner->id}", ['role' => 'viewer'])->assertSessionHasErrors('role');
    $this->actingAs($this->owner)->post('/w/PLQ/anggota', ['user_id' => $existing->id, 'role' => 'admin'])->assertSessionHasErrors('user_id');
    $this->actingAs($this->owner)->post('/w/PLQ/anggota', ['user_id' => $existing->id, 'role' => 'owner'])->assertSessionHasErrors('role');

    expect($this->workspace->roleOf($synced))->toBe(WorkspaceRole::Member);
});

it('does not allow members on personal workspaces', function () {
    $personal = Workspace::query()->where('type', 'personal')->where('owner_id', $this->owner->id)->firstOrFail();

    $this->actingAs($this->owner)
        ->post("/w/{$personal->key}/anggota", ['user_id' => User::factory()->create()->id, 'role' => 'member'])
        ->assertForbidden();
});

it('manages columns and keeps task categories in sync', function () {
    $task = app(CreateTask::class)->handle($this->workspace, $this->owner, ['title' => 'Menunggu']);
    $review = statusOf($this->workspace, 'review');

    $this->actingAs($this->owner)->post('/w/PLQ/status', ['name' => 'Menunggu persetujuan', 'category' => 'review', 'color' => 'violet'])->assertRedirect();
    $waiting = TaskStatus::query()->where('name', 'Menunggu persetujuan')->firstOrFail();
    expect(TaskStatus::query()->where('workspace_id', $this->workspace->id)->orderBy('position')->get()->last()?->id)->toBe($waiting->id);

    // Changing the category of a column updates its tasks.
    $todo = statusOf($this->workspace, 'todo');
    $this->actingAs($this->owner)->patch("/w/PLQ/status/{$todo->id}", ['category' => 'done'])->assertRedirect();
    expect($task->fresh()?->status_category)->toBe(TaskStatusCategory::Done)
        ->and($task->fresh()?->completed_at)->not->toBeNull();

    // Reorder.
    $ids = TaskStatus::query()->where('workspace_id', $this->workspace->id)->orderBy('position')->pluck('id')->reverse()->values()->all();
    $this->actingAs($this->owner)->put('/w/PLQ/status-urutan', ['status_ids' => $ids])->assertRedirect();
    expect(TaskStatus::query()->where('workspace_id', $this->workspace->id)->orderBy('position')->pluck('id')->all())->toBe($ids);

    // Deleting a column with tasks needs a target column.
    $this->actingAs($this->owner)->delete("/w/PLQ/status/{$todo->id}")->assertSessionHasErrors('target_status_id');
    $this->actingAs($this->owner)->delete("/w/PLQ/status/{$todo->id}", ['target_status_id' => $review->id])->assertRedirect();
    expect(TaskStatus::query()->find($todo->id))->toBeNull()
        ->and($task->fresh()?->status_id)->toBe($review->id)
        ->and($task->fresh()?->status_category)->toBe(TaskStatusCategory::Review)
        ->and($task->fresh()?->completed_at)->toBeNull();
});

it('scopes columns and labels to their workspace', function () {
    $other = Workspace::factory()->ownedBy($this->owner)->create(['key' => 'OPS']);
    $foreignStatus = statusOf($other, 'todo');
    $foreignLabel = Label::factory()->create(['workspace_id' => $other->id]);

    $this->actingAs($this->owner)->patch("/w/PLQ/status/{$foreignStatus->id}", ['name' => 'X'])->assertNotFound();
    $this->actingAs($this->owner)->delete("/w/PLQ/label/{$foreignLabel->id}")->assertNotFound();
});

it('manages labels with unique names', function () {
    $this->actingAs($this->owner)->post('/w/PLQ/label', ['name' => 'Konten', 'color' => 'violet'])->assertRedirect();
    $this->actingAs($this->owner)->post('/w/PLQ/label', ['name' => 'Konten', 'color' => 'blue'])->assertSessionHasErrors(['name' => 'Label dengan nama ini sudah ada.']);
    $this->actingAs($this->owner)->post('/w/PLQ/label', ['name' => 'Hex', 'color' => '#ff0000'])->assertSessionHasErrors('color');

    $label = Label::query()->where('name', 'Konten')->firstOrFail();
    $this->actingAs($this->owner)->patch("/w/PLQ/label/{$label->id}", ['name' => 'Konten media', 'color' => 'pink'])->assertRedirect();
    expect($label->fresh()?->color)->toBe('pink');

    $this->actingAs(memberWithRole($this->workspace, WorkspaceRole::Member))->delete("/w/PLQ/label/{$label->id}")->assertForbidden();
    $this->actingAs($this->owner)->delete("/w/PLQ/label/{$label->id}")->assertRedirect();
    expect(Label::query()->count())->toBe(0);
});

it('archives and restores (owner only) and makes the workspace read-only', function () {
    $admin = memberWithRole($this->workspace, WorkspaceRole::Admin);
    $task = app(CreateTask::class)->handle($this->workspace, $this->owner, ['title' => 'Sebelum arsip']);

    $this->actingAs($admin)->post('/w/PLQ/arsip')->assertForbidden();
    $this->actingAs($this->owner)->post('/w/PLQ/arsip')->assertRedirect('/w/PLQ/pengaturan');

    expect($this->workspace->fresh()->isArchived())->toBeTrue()
        ->and(AuditLog::query()->where('action', 'workspace.archived')->exists())->toBeTrue();

    $this->actingAs($this->owner)->patch("/tugas/{$task->id}", ['title' => 'Tidak bisa'])->assertForbidden();
    $this->actingAs($this->owner)->patch('/w/PLQ', ['name' => 'Tidak bisa'])->assertForbidden();
    $this->actingAs($this->owner)->get('/w/PLQ')->assertOk();

    $this->actingAs($this->owner)->delete('/w/PLQ/arsip')->assertRedirect();
    expect($this->workspace->fresh()->isArchived())->toBeFalse();
});

it('stars workspaces for members', function () {
    $member = memberWithRole($this->workspace, WorkspaceRole::Member);

    $this->actingAs($member)->post('/w/PLQ/favorit')->assertRedirect();
    expect($this->workspace->memberships()->where('user_id', $member->id)->value('favorited_at'))->not->toBeNull();

    $this->actingAs($member)->delete('/w/PLQ/favorit')->assertRedirect();
    expect($this->workspace->memberships()->where('user_id', $member->id)->first()?->favorited_at)->toBeNull();

    $this->actingAs(User::factory()->withRole(Role::Direksi)->create())->post('/w/PLQ/favorit')->assertForbidden();
});

it('creates team and project workspaces for allowed roles only', function () {
    $this->actingAs($this->owner)
        ->post('/workspace', ['type' => 'project', 'name' => 'Peluncuran Produk X', 'visibility' => 'private'])
        ->assertRedirect('/w/PPX');

    $created = Workspace::query()->where('key', 'PPX')->firstOrFail();
    expect($created->roleOf($this->owner))->toBe(WorkspaceRole::Owner)
        ->and($created->statuses()->count())->toBe(5);

    $this->actingAs(User::factory()->withRole(Role::Anggota)->create())
        ->post('/workspace', ['type' => 'project', 'name' => 'Tidak boleh', 'visibility' => 'private'])
        ->assertForbidden();

    $this->actingAs($this->owner)
        ->post('/workspace', ['type' => 'division', 'name' => 'Divisi baru', 'visibility' => 'private'])
        ->assertSessionHasErrors('type');
});
