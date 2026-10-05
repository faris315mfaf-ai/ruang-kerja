<?php

use App\Domain\Organization\Enums\UserStatus;
use App\Domain\Projects\Notifications\ProjectDecisionNeededNotification;
use App\Domain\Projects\Notifications\ProjectUpdateRequestedNotification;
use App\Domain\Tasks\Actions\CreateTask;
use App\Domain\Tasks\Actions\DeleteComment;
use App\Domain\Tasks\Actions\PostComment;
use App\Domain\Tasks\Notifications\MentionNotification;
use App\Domain\Tasks\Notifications\TaskAssignedNotification;
use App\Domain\Tasks\Notifications\TaskCommentedNotification;
use App\Domain\Workspaces\Actions\RemoveWorkspaceMember;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Models\InboxNotification;
use App\Models\ProjectUpdate;
use App\Models\User;
use App\Models\Workspace;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Notification;

require_once __DIR__.'/../../Support/workspace-helpers.php';

/*
 * Queued / quiet-hours-delayed notifications are re-checked right before each
 * channel delivers (BaseNotification::shouldSend()).
 */

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->owner = User::factory()->create(['name' => 'Dimas Pratama']);
    $this->workspace = Workspace::factory()->ownedBy($this->owner)->create(['key' => 'PLQ']);
    $this->member = memberWithRole($this->workspace, WorkspaceRole::Member);
    $this->task = app(CreateTask::class)->handle($this->workspace, $this->owner, ['title' => 'Landing page produk baru']);
});

function inboxCountFor(User $user): int
{
    return InboxNotification::query()->visibleTo($user)->count();
}

it('drops a task notification for a recipient removed from the workspace before delivery', function () {
    $notification = new TaskAssignedNotification($this->task, $this->owner);

    expect($notification->shouldSend($this->member, 'mail'))->toBeTrue();

    app(RemoveWorkspaceMember::class)->handle($this->workspace, $this->owner, $this->member);

    expect($notification->shouldSend($this->member, 'mail'))->toBeFalse()
        ->and($notification->shouldSend($this->member, 'broadcast'))->toBeFalse();

    Notification::sendNow($this->member, $notification);

    expect(inboxCountFor($this->member))->toBe(0);
});

it('drops a task notification once the task or its workspace is deleted', function () {
    $notification = new TaskAssignedNotification($this->task, $this->owner);

    $this->task->delete();
    expect($notification->shouldSend($this->member, 'mail'))->toBeFalse();

    $this->task->restore();
    expect($notification->shouldSend($this->member, 'mail'))->toBeTrue();

    $this->workspace->delete();
    expect($notification->shouldSend($this->member, 'mail'))->toBeFalse();
});

it('drops notifications for deactivated recipients', function () {
    $notification = new TaskAssignedNotification($this->task, $this->owner);

    $this->member->forceFill(['status' => UserStatus::Resigned])->save();

    expect($notification->shouldSend($this->member, 'mail'))->toBeFalse();
});

it('never delivers a comment or mention notification of a deleted comment', function () {
    Notification::fake();
    $comment = app(PostComment::class)->handle($this->task, $this->owner, richDoc('Halo'));
    $commented = new TaskCommentedNotification($this->task, $comment, $this->owner);
    $mention = new MentionNotification($this->task, $this->owner, $comment);

    expect($commented->shouldSend($this->member, 'mail'))->toBeTrue()
        ->and($mention->shouldSend($this->member, 'mail'))->toBeTrue();

    app(DeleteComment::class)->handle($comment, $this->owner);
    $trashed = $comment->fresh() ?? $comment;
    $restored = new TaskCommentedNotification($this->task, $trashed, $this->owner);

    expect($restored->shouldSend($this->member, 'mail'))->toBeFalse()
        ->and((new MentionNotification($this->task, $this->owner, $trashed))->shouldSend($this->member, 'mail'))->toBeFalse()
        // Description mentions have no comment and only depend on the task.
        ->and((new MentionNotification($this->task, $this->owner))->shouldSend($this->member, 'mail'))->toBeTrue();
});

it('removes Inbox notifications quoting a comment when the comment is deleted', function () {
    $comment = app(PostComment::class)->handle($this->task, $this->member, richDoc('Rahasia: ', ['@', $this->owner], ' cek angka ini'));

    // The task creator watches it (commented) and is mentioned → both carry meta.comment_id.
    $quoting = InboxNotification::query()->visibleTo($this->owner)->get()
        ->filter(fn (InboxNotification $n) => ($n->data['meta']['comment_id'] ?? null) === $comment->id);
    expect($quoting)->not->toBeEmpty();
    $other = InboxNotification::factory()->create(['notifiable_id' => $this->owner->id, 'data' => ['title' => 'Lain', 'meta' => ['comment_id' => 'lain']]]);

    app(DeleteComment::class)->handle($comment, $this->member);

    expect(InboxNotification::query()->whereIn('id', $quoting->modelKeys())->exists())->toBeFalse()
        ->and($other->fresh())->not->toBeNull();
});

it('drops project notifications for recipients who can no longer see the project', function () {
    $update = ProjectUpdate::factory()->for($this->workspace, 'workspace')->withDecision()->create(['author_id' => $this->owner->id]);
    $decision = new ProjectDecisionNeededNotification($update);
    $requested = new ProjectUpdateRequestedNotification($this->workspace, $this->owner);

    expect($decision->shouldSend($this->member, 'mail'))->toBeTrue()
        ->and($requested->shouldSend($this->member, 'mail'))->toBeTrue();

    app(RemoveWorkspaceMember::class)->handle($this->workspace, $this->owner, $this->member);

    expect($decision->shouldSend($this->member, 'mail'))->toBeFalse()
        ->and($requested->shouldSend($this->member, 'mail'))->toBeFalse()
        ->and($requested->shouldSend($this->owner, 'mail'))->toBeTrue();
});
