<?php

use App\Domain\Tasks\Actions\SaveView;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Models\SavedView;
use App\Models\User;
use App\Models\Workspace;
use Database\Seeders\RoleSeeder;
use Inertia\Testing\AssertableInertia as Assert;

require_once __DIR__.'/../../Support/workspace-helpers.php';

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->owner = User::factory()->create();
    $this->workspace = Workspace::factory()->ownedBy($this->owner)->create(['key' => 'OPS']);
    $this->member = memberWithRole($this->workspace, WorkspaceRole::Member);
    $this->viewer = memberWithRole($this->workspace, WorkspaceRole::Viewer);
});

it('saves a personal view with normalized filters', function () {
    $this->actingAs($this->member)
        ->postJson('/w/OPS/tampilan', [
            'name' => 'Tenggat minggu ini',
            'layout' => 'list',
            'filters' => ['assignees' => ['me', 'me'], 'priorities' => [1, 2], 'due' => 'week', 'q' => '  laporan ', 'unknown' => 'x'],
        ])
        ->assertCreated()
        ->assertJsonPath('view.mine', true)
        ->assertJsonPath('view.is_shared', false)
        ->assertJsonPath('view.filters', ['assignees' => ['me'], 'priorities' => [1, 2], 'labels' => [], 'due' => 'week', 'q' => 'laporan']);
});

it('shows personal views only to their owner and shared views to everyone who can see the workspace', function () {
    $personal = SavedView::factory()->create(['user_id' => $this->member->id, 'workspace_id' => $this->workspace->id, 'name' => 'Punyaku']);
    $shared = SavedView::factory()->shared()->create(['user_id' => $this->member->id, 'workspace_id' => $this->workspace->id, 'name' => 'Tim']);

    $names = fn (User $user) => SavedView::query()->visibleTo($user)->orderBy('name')->pluck('name')->all();

    expect($names($this->member))->toBe(['Punyaku', 'Tim'])
        ->and($names($this->viewer))->toBe(['Tim'])
        ->and($names(User::factory()->create()))->toBe([]);

    $this->actingAs($this->viewer)
        ->get('/w/OPS')
        ->assertInertia(fn (Assert $page) => $page
            ->has('saved_views', 1)
            ->where('saved_views.0.name', 'Tim')
            ->where('saved_views.0.mine', false)
            ->where('saved_views.0.owner', $this->member->name));

    // Others cannot change or remove a personal view; it does not even exist for them.
    $this->actingAs($this->viewer)->patchJson("/w/OPS/tampilan/{$personal->id}", ['name' => 'X'])->assertNotFound();
    $this->actingAs($this->viewer)->patchJson("/w/OPS/tampilan/{$shared->id}", ['name' => 'X'])->assertForbidden();
    $this->actingAs($this->viewer)->deleteJson("/w/OPS/tampilan/{$shared->id}")->assertForbidden();
});

it('requires task edit rights to share a view', function () {
    $this->actingAs($this->viewer)
        ->postJson('/w/OPS/tampilan', ['name' => 'Bersama', 'layout' => 'board', 'is_shared' => true])
        ->assertForbidden();

    $this->actingAs($this->viewer)
        ->postJson('/w/OPS/tampilan', ['name' => 'Pribadi', 'layout' => 'board'])
        ->assertCreated();

    $this->actingAs(User::factory()->create())
        ->postJson('/w/OPS/tampilan', ['name' => 'Luar', 'layout' => 'board'])
        ->assertNotFound();
});

it('lets the owner update and delete, and a workspace admin delete shared views', function () {
    $view = app(SaveView::class)->handle($this->member, $this->workspace, ['name' => 'Awal', 'layout' => 'board']);

    $this->actingAs($this->member)
        ->patchJson("/w/OPS/tampilan/{$view->id}", ['name' => 'Baru', 'is_shared' => true])
        ->assertOk()
        ->assertJsonPath('view.name', 'Baru')
        ->assertJsonPath('view.is_shared', true)
        ->assertJsonPath('view.layout', 'board');

    $this->actingAs($this->owner)->deleteJson("/w/OPS/tampilan/{$view->id}")->assertNoContent();
    expect(SavedView::query()->count())->toBe(0);
});

it('rejects a view id from another workspace', function () {
    $other = Workspace::factory()->ownedBy($this->member)->create(['key' => 'LAIN']);
    $view = SavedView::factory()->create(['user_id' => $this->member->id, 'workspace_id' => $other->id]);

    $this->actingAs($this->member)->deleteJson("/w/OPS/tampilan/{$view->id}")->assertNotFound();
});

it('validates name and layout', function () {
    $this->actingAs($this->member)
        ->postJson('/w/OPS/tampilan', ['name' => '', 'layout' => 'gantt'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['name', 'layout']);
});
