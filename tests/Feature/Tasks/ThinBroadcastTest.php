<?php

use App\Domain\Tasks\Actions\CreateTask;
use App\Domain\Tasks\Actions\PostComment;
use App\Domain\Tasks\Actions\UpdateTask;
use App\Domain\Workspaces\Actions\RemoveWorkspaceMember;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Events\Tasks\CommentPosted;
use App\Events\Tasks\TaskCreated;
use App\Events\Tasks\TaskDeleted;
use App\Events\Tasks\TaskUpdated;
use App\Models\User;
use App\Models\Workspace;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;

require_once __DIR__.'/../../Support/workspace-helpers.php';

/*
 * Channel authorization only runs when subscribing: a member removed from a
 * private workspace may still receive its events until they reload. Events
 * therefore never carry content; clients refetch through authorized endpoints.
 */

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Notification::fake();
    $this->owner = User::factory()->create();
    $this->workspace = Workspace::factory()->ownedBy($this->owner)->create(['key' => 'PLQ']);
    $this->member = memberWithRole($this->workspace, WorkspaceRole::Member);
    $this->task = app(CreateTask::class)->handle($this->workspace, $this->owner, [
        'title' => 'Negosiasi kontrak rahasia',
        'description' => richDoc('Harga final Rp 1,2 M'),
    ]);
});

it('broadcasts task events with ids and placement only', function () {
    Event::fake([TaskUpdated::class, TaskCreated::class]);

    app(UpdateTask::class)->handle($this->task, $this->owner, ['title' => 'Judul baru rahasia']);

    Event::assertDispatched(TaskUpdated::class, function (TaskUpdated $event) {
        $payload = $event->broadcastWith();

        expect(array_keys($payload['task']))->toEqualCanonicalizing(['id', 'workspace_id', 'parent_id', 'status_id', 'status_category', 'position', 'updated_at'])
            ->and(json_encode($payload))->not->toContain('rahasia')
            ->and(json_encode($payload))->not->toContain('Rp 1,2 M');

        return $payload['task']['id'] === $this->task->id;
    });
});

it('broadcasts task deletion with ids only', function () {
    $payload = (new TaskDeleted($this->task))->broadcastWith();

    expect($payload)->toBe(['task' => ['id' => $this->task->id, 'workspace_id' => $this->workspace->id, 'parent_id' => null]]);
});

it('never broadcasts comment bodies', function () {
    Event::fake([CommentPosted::class]);

    $comment = app(PostComment::class)->handle($this->task, $this->member, richDoc('Angka rahasia 42'));

    Event::assertDispatched(CommentPosted::class, function (CommentPosted $event) use ($comment) {
        expect($event->broadcastWith())->toBe(['task_id' => $this->task->id, 'comment' => ['id' => $comment->id]]);

        return true;
    });
});

it('serves the board card to members and 404 once access is gone', function () {
    $this->actingAs($this->member)
        ->getJson("/tugas/{$this->task->id}?view=card")
        ->assertOk()
        ->assertJsonPath('task.id', $this->task->id)
        ->assertJsonPath('task.title', 'Negosiasi kontrak rahasia')
        ->assertJsonMissingPath('timeline');

    app(RemoveWorkspaceMember::class)->handle($this->workspace, $this->owner, $this->member);

    $this->actingAs($this->member)->getJson("/tugas/{$this->task->id}?view=card")->assertNotFound();
});
