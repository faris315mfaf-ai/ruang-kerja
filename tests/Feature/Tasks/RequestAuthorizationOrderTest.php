<?php

use App\Domain\Tasks\Actions\CreateTask;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Models\ChecklistItem;
use App\Models\Comment;
use App\Models\SavedView;
use App\Models\User;
use App\Models\Workspace;
use Database\Seeders\RoleSeeder;

require_once __DIR__.'/../../Support/workspace-helpers.php';

/*
 * People who cannot see a private workspace get 404 before validation, so
 * validation messages never confirm that a task/comment/view exists.
 */

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->owner = User::factory()->create();
    $this->workspace = Workspace::factory()->ownedBy($this->owner)->create(['key' => 'SEC']);
    $this->task = app(CreateTask::class)->handle($this->workspace, $this->owner, ['title' => 'Rahasia']);
    $this->outsider = User::factory()->create();
});

it('answers 404 to non-viewers before validating comments', function () {
    $comment = Comment::factory()->on($this->task)->by($this->owner)->create();

    $this->actingAs($this->outsider)->postJson("/tugas/{$this->task->id}/komentar", ['body' => 'x'])->assertNotFound();
    $this->actingAs($this->outsider)->patchJson("/komentar/{$comment->id}", ['body' => 'x'])->assertNotFound();
});

it('answers 404 to non-viewers before validating checklist lines', function () {
    $item = ChecklistItem::query()->create(['task_id' => $this->task->id, 'title' => 'Satu', 'position' => 1]);

    $this->actingAs($this->outsider)->postJson("/tugas/{$this->task->id}/checklist", ['title' => ''])->assertNotFound();
    $this->actingAs($this->outsider)->patchJson("/checklist/{$item->id}", ['title' => str_repeat('x', 300)])->assertNotFound();
});

it('answers 404 to non-viewers before validating saved views', function () {
    $view = SavedView::factory()->create(['workspace_id' => $this->workspace->id, 'user_id' => $this->owner->id]);

    $this->actingAs($this->outsider)->postJson('/w/SEC/tampilan', ['name' => ''])->assertNotFound();
    $this->actingAs($this->outsider)->patchJson("/w/SEC/tampilan/{$view->id}", ['layout' => 'nope'])->assertNotFound();

    // A member still gets validation errors.
    addMember($this->workspace, $member = User::factory()->create(), WorkspaceRole::Member);
    $this->actingAs($member)->postJson('/w/SEC/tampilan', ['name' => ''])->assertUnprocessable();
});
