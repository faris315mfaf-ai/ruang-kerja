<?php

use App\Domain\Organization\Enums\Role;
use App\Domain\Tasks\Actions\CreateTask;
use App\Domain\Tasks\Actions\DeleteComment;
use App\Domain\Tasks\Actions\PostComment;
use App\Domain\Tasks\Actions\ToggleReaction;
use App\Domain\Tasks\Actions\UpdateComment;
use App\Domain\Tasks\Notifications\TaskCommentedNotification;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Events\Tasks\CommentDeleted;
use App\Events\Tasks\CommentPosted;
use App\Events\Tasks\CommentUpdated;
use App\Models\AuditLog;
use App\Models\Comment;
use App\Models\Reaction;
use App\Models\User;
use App\Models\Workspace;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;

require_once __DIR__.'/../../Support/workspace-helpers.php';

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->owner = User::factory()->create(['name' => 'Dimas Pratama']);
    $this->workspace = Workspace::factory()->ownedBy($this->owner)->create(['key' => 'PLQ']);
    $this->member = memberWithRole($this->workspace, WorkspaceRole::Member);
    $this->other = memberWithRole($this->workspace, WorkspaceRole::Member);
    $this->task = app(CreateTask::class)->handle($this->workspace, $this->owner, ['title' => 'Landing page produk baru']);
});

it('posts a comment: sanitized body, author becomes watcher, watchers notified, event broadcast', function () {
    Notification::fake();
    Event::fake([CommentPosted::class]);

    $comment = app(PostComment::class)->handle($this->task, $this->member, richDoc('Brief sudah final.'));

    expect($comment->body_text)->toBe('Brief sudah final.')
        ->and($comment->edited_at)->toBeNull()
        ->and($this->task->watchers()->pluck('users.id')->all())->toContain($this->member->id);

    // The creator watches the task → "mengomentari"; the author does not notify themselves.
    Notification::assertSentTo($this->owner, TaskCommentedNotification::class, function (TaskCommentedNotification $n) use ($comment) {
        $payload = $n->payload($this->owner);

        return $payload->title === "{$this->member->name} mengomentari PLQ-1"
            && $payload->url === '/w/PLQ/tasks/1#komentar-'.$comment->id
            && $payload->meta['quote'] === true;
    });
    Notification::assertNotSentTo($this->member, TaskCommentedNotification::class);
    Event::assertDispatched(CommentPosted::class, fn (CommentPosted $event) => $event->broadcastOn()[0]->name === 'private-workspace.'.$this->workspace->id
        && $event->broadcastAs() === 'comment.posted'
        && $event->broadcastWith() === ['task_id' => $this->task->id, 'comment' => ['id' => $comment->id]]);
});

it('rejects empty comments', function () {
    $this->actingAs($this->member)
        ->postJson("/tugas/{$this->task->id}/komentar", ['body' => richDoc('   ')])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['body' => 'Komentar tidak boleh kosong.']);

    $this->actingAs($this->member)
        ->postJson("/tugas/{$this->task->id}/komentar", ['body' => ['type' => 'paragraph']])
        ->assertUnprocessable();
});

it('posts, edits ("diedit") and deletes over HTTP', function () {
    Notification::fake();

    $id = $this->actingAs($this->member)
        ->postJson("/tugas/{$this->task->id}/komentar", ['body' => richDoc('Halo tim')])
        ->assertCreated()
        ->assertJsonPath('comment.author.id', $this->member->id)
        ->assertJsonPath('comment.edited_at', null)
        ->json('comment.id');

    $this->actingAs($this->member)
        ->patchJson("/komentar/{$id}", ['body' => richDoc('Halo tim, revisi')])
        ->assertOk()
        ->assertJsonPath('comment.body_text', 'Halo tim, revisi')
        ->assertJsonPath('comment.edited_at', fn ($value) => is_string($value));

    $this->actingAs($this->member)
        ->deleteJson("/komentar/{$id}")
        ->assertOk()
        ->assertJsonPath('comment.deleted', true)
        ->assertJsonPath('comment.body', null);

    expect(Comment::withTrashed()->find($id)?->trashed())->toBeTrue();

    // Gone for good: no further edits.
    $this->actingAs($this->member)->patchJson("/komentar/{$id}", ['body' => richDoc('x')])->assertNotFound();
});

it('only lets the author edit a comment', function () {
    $comment = Comment::factory()->on($this->task)->by($this->member)->create();

    $this->actingAs($this->other)->patchJson("/komentar/{$comment->id}", ['body' => richDoc('Bukan punyaku')])->assertForbidden();
    $this->actingAs($this->owner)->patchJson("/komentar/{$comment->id}", ['body' => richDoc('Admin pun tidak')])->assertForbidden();
});

it('rejects deleting by someone else, unless workspace admin (audited)', function () {
    $comment = Comment::factory()->on($this->task)->by($this->member)->create();

    $this->actingAs($this->other)->deleteJson("/komentar/{$comment->id}")
        ->assertForbidden()
        ->assertJsonPath('message', 'Hanya penulis atau admin workspace yang dapat menghapus komentar ini.');
    $this->actingAs(memberWithRole($this->workspace, WorkspaceRole::Viewer))->deleteJson("/komentar/{$comment->id}")->assertForbidden();
    $this->actingAs(User::factory()->create())->deleteJson("/komentar/{$comment->id}")->assertNotFound();

    expect($comment->fresh()?->trashed())->toBeFalse();

    $admin = memberWithRole($this->workspace, WorkspaceRole::Admin);
    $this->actingAs($admin)->deleteJson("/komentar/{$comment->id}")->assertOk();

    expect(Comment::withTrashed()->find($comment->id)?->trashed())->toBeTrue()
        ->and(AuditLog::query()->where('action', 'comment.deleted')->where('user_id', $admin->id)->exists())->toBeTrue();
});

it('lets the workspace owner delete any comment', function () {
    $comment = Comment::factory()->on($this->task)->by($this->member)->create();

    $this->actingAs($this->owner)->deleteJson("/komentar/{$comment->id}")->assertOk();
});

it('toggles emoji reactions, unique per user and emoji', function () {
    Event::fake([CommentUpdated::class]);
    $comment = Comment::factory()->on($this->task)->by($this->member)->create();
    $toggle = app(ToggleReaction::class);

    expect($toggle->handle($comment, $this->other, '👍'))->toBeTrue()
        ->and($toggle->handle($comment, $this->owner, '👍'))->toBeTrue()
        ->and($toggle->handle($comment, $this->other, '🎉'))->toBeTrue()
        ->and(Reaction::query()->count())->toBe(3)
        ->and($toggle->handle($comment, $this->other, '👍'))->toBeFalse()
        ->and(Reaction::query()->count())->toBe(2);

    $this->actingAs($this->other)
        ->postJson("/komentar/{$comment->id}/reaksi", ['emoji' => '👍'])
        ->assertOk()
        ->assertJsonPath('added', true)
        ->assertJsonPath('comment.reactions.0.emoji', '👍')
        ->assertJsonPath('comment.reactions.0.count', 2)
        ->assertJsonPath('comment.reactions.0.user_ids', [$this->owner->id, $this->other->id]);

    $this->actingAs($this->other)->postJson("/komentar/{$comment->id}/reaksi", ['emoji' => '💩'])->assertUnprocessable();
    $this->actingAs(User::factory()->create())->postJson("/komentar/{$comment->id}/reaksi", ['emoji' => '👍'])->assertNotFound();

    Event::assertDispatched(CommentUpdated::class);
});

it('lets viewers and Direksi comment but nobody on an archived workspace', function () {
    Notification::fake();
    $viewer = memberWithRole($this->workspace, WorkspaceRole::Viewer);
    $direksi = User::factory()->withRole(Role::Direksi)->create();

    $this->actingAs($viewer)->postJson("/tugas/{$this->task->id}/komentar", ['body' => richDoc('Catatan viewer')])->assertCreated();
    $this->actingAs($direksi)->postJson("/tugas/{$this->task->id}/komentar", ['body' => richDoc('Arahan direksi')])->assertCreated();
    $this->actingAs(User::factory()->create())->postJson("/tugas/{$this->task->id}/komentar", ['body' => richDoc('Orang luar')])->assertNotFound();

    $this->workspace->forceFill(['archived_at' => now()])->save();

    $this->actingAs($this->member)->postJson("/tugas/{$this->task->id}/komentar", ['body' => richDoc('Arsip')])->assertForbidden();
});

it('dispatches CommentUpdated on edit and CommentDeleted on delete', function () {
    Event::fake([CommentUpdated::class, CommentDeleted::class]);
    Notification::fake();
    $comment = Comment::factory()->on($this->task)->by($this->member)->create();

    app(UpdateComment::class)->handle($comment, $this->member, richDoc('Baru'));
    app(DeleteComment::class)->handle($comment, $this->member);

    Event::assertDispatched(CommentUpdated::class, fn (CommentUpdated $e) => $e->broadcastAs() === 'comment.updated');
    Event::assertDispatched(CommentDeleted::class, fn (CommentDeleted $e) => $e->broadcastWith()['comment'] === ['id' => $comment->id]);
    expect(AuditLog::query()->where('action', 'comment.deleted')->exists())->toBeFalse();
});

it('keeps spaces around mentions and marks (no input trimming inside rich text)', function () {
    Notification::fake();

    $this->actingAs($this->member)
        ->postJson("/tugas/{$this->task->id}/komentar", ['body' => richDoc('Halo ', ['@', $this->other], ' tolong cek ')])
        ->assertCreated()
        ->assertJsonPath('comment.body.content.0.content.0.text', 'Halo ')
        ->assertJsonPath('comment.body.content.0.content.2.text', ' tolong cek ')
        ->assertJsonPath('comment.body_text', "Halo @{$this->other->name} tolong cek");
});

it('throttles reactions like comments', function () {
    Notification::fake();
    $comment = Comment::factory()->on($this->task)->by($this->owner)->create();

    foreach (range(1, 30) as $i) {
        $this->actingAs($this->member)->postJson("/komentar/{$comment->id}/reaksi", ['emoji' => '👍'])->assertOk();
    }

    $this->actingAs($this->member)->postJson("/komentar/{$comment->id}/reaksi", ['emoji' => '👍'])->assertTooManyRequests();
});
