<?php

use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Organization\Enums\Role;
use App\Domain\Tasks\Actions\CreateTask;
use App\Domain\Tasks\Actions\MarkCommentsRead;
use App\Domain\Tasks\Actions\PostComment;
use App\Domain\Tasks\Queries\BoardTasks;
use App\Domain\Tasks\Queries\TaskDetail;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Domain\Workspaces\Enums\WorkspaceVisibility;
use App\Events\Tasks\CommentsRead;
use App\Http\Resources\TaskResource;
use App\Models\Comment;
use App\Models\InboxNotification;
use App\Models\Task;
use App\Models\TaskCommentRead;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;

require_once __DIR__.'/../../Support/workspace-helpers.php';

/*
 * Tanda baca komentar (backlog Sprint 6): one read pointer per person per task
 * (task_comment_reads), "Dibaca oleh" in the task detail, unread dot on cards.
 */

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->owner = User::factory()->create(['name' => 'Dimas Pratama']);
    $this->workspace = Workspace::factory()->ownedBy($this->owner)->create(['key' => 'PLQ']);
    $this->member = memberWithRole($this->workspace, WorkspaceRole::Member);
    $this->other = memberWithRole($this->workspace, WorkspaceRole::Viewer);
    $this->task = app(CreateTask::class)->handle($this->workspace, $this->owner, ['title' => 'Landing page']);
});

function commentOn(Task $task, User $author, string $at, array $attributes = []): Comment
{
    return Comment::factory()->on($task)->by($author)->create(['created_at' => $at, 'updated_at' => $at, ...$attributes]);
}

function pointerOf(Task $task, User $user): ?TaskCommentRead
{
    return TaskCommentRead::query()->where('task_id', $task->id)->where('user_id', $user->id)->first();
}

it('moves the pointer to the newest comment and never backwards', function () {
    Event::fake([CommentsRead::class]);
    $first = commentOn($this->task, $this->member, '2026-10-07 09:00:00');
    $second = commentOn($this->task, $this->other, '2026-10-07 09:05:00');
    $mark = app(MarkCommentsRead::class);

    $pointer = $mark->handle($this->task, $this->owner);

    expect($pointer['last_read_comment_id'])->toBe($second->id)
        ->and($pointer['user'])->toBe(['id' => $this->owner->id, 'name' => 'Dimas Pratama', 'avatar' => null])
        ->and(pointerOf($this->task, $this->owner)->last_read_at->toIso8601String())->toBe($second->created_at->toIso8601String());

    // An old tab reporting the first comment does not undo the newer read.
    expect($mark->handle($this->task, $this->owner, $first->id)['last_read_comment_id'])->toBe($second->id)
        ->and(TaskCommentRead::query()->count())->toBe(1);

    Event::assertDispatchedTimes(CommentsRead::class, 1);
});

it('orders comments of the same second by id', function () {
    $a = commentOn($this->task, $this->member, '2026-10-07 09:00:00');
    $b = commentOn($this->task, $this->member, '2026-10-07 09:00:00');
    [$older, $newer] = strcmp($a->id, $b->id) < 0 ? [$a, $b] : [$b, $a];
    $mark = app(MarkCommentsRead::class);

    $mark->handle($this->task, $this->owner, $older->id);
    expect(pointerOf($this->task, $this->owner)->last_read_comment_id)->toBe($older->id);

    $mark->handle($this->task, $this->owner, $newer->id);
    expect(pointerOf($this->task, $this->owner)->last_read_comment_id)->toBe($newer->id);
});

it('keeps no pointer for a task without comments and rejects comments of other tasks', function () {
    expect(app(MarkCommentsRead::class)->handle($this->task, $this->owner))->toBeNull()
        ->and(TaskCommentRead::query()->count())->toBe(0);

    $elsewhere = app(CreateTask::class)->handle($this->workspace, $this->owner, ['title' => 'Lain']);
    $foreign = commentOn($elsewhere, $this->member, '2026-10-07 09:00:00');

    $this->actingAs($this->owner)
        ->postJson("/tugas/{$this->task->id}/komentar/dibaca", ['comment_id' => $foreign->id])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('comment_id');
});

it('marks the Inbox notifications of the comments it covers as read', function () {
    $seen = app(PostComment::class)->handle($this->task, $this->member, richDoc('Halo ', ['@', $this->owner]));
    $this->travel(1)->minutes();
    $later = app(PostComment::class)->handle($this->task, $this->other, richDoc('Masih baru'));
    $notifications = fn () => InboxNotification::query()->visibleTo($this->owner)->get();

    // Mention (first comment) + "mengomentari" (second; the first only mentions the watcher).
    expect($notifications()->pluck('type')->sort()->values()->all())->toBe(['mention', 'task.commented'])
        ->and($notifications()->whereNull('read_at'))->toHaveCount(2);

    $foreignTask = app(CreateTask::class)->handle($this->workspace, $this->owner, ['title' => 'Lain']);
    $unrelated = InboxNotification::factory()->recipient($this->owner)->ofType(NotificationType::TaskCommented)
        ->withData(['meta' => ['comment_id' => $seen->id]])
        ->create(['subject_type' => $foreignTask->getMorphClass(), 'subject_id' => $foreignTask->id]);

    app(MarkCommentsRead::class)->handle($this->task, $this->owner, $seen->id);

    $byComment = $notifications()->keyBy(fn (InboxNotification $n) => $n->id === $unrelated->id ? 'unrelated' : $n->data['meta']['comment_id']);
    expect($byComment[$seen->id]->read_at)->not->toBeNull()
        ->and($byComment[$later->id]->read_at)->toBeNull()
        ->and($byComment['unrelated']->read_at)->toBeNull();

    app(MarkCommentsRead::class)->handle($this->task, $this->owner);
    expect($byComment[$later->id]->fresh()->read_at)->not->toBeNull();
});

it('broadcasts the new pointer on the task presence channel only when it moves', function () {
    Event::fake([CommentsRead::class]);
    $comment = commentOn($this->task, $this->member, '2026-10-07 09:00:00');

    app(MarkCommentsRead::class)->handle($this->task, $this->owner);
    app(MarkCommentsRead::class)->handle($this->task, $this->owner);

    Event::assertDispatchedTimes(CommentsRead::class, 1);
    Event::assertDispatched(CommentsRead::class, function (CommentsRead $event) use ($comment) {
        $payload = $event->broadcastWith();

        return $event->broadcastOn()[0]->name === 'presence-task.'.$this->task->id
            && $event->broadcastAs() === 'comment.read'
            && $event->broadcastQueue() === 'realtime'
            && array_keys($payload) === ['task_id', 'user', 'last_read_comment_id', 'last_read_at', 'read_at']
            && $payload['last_read_comment_id'] === $comment->id
            && $payload['user']['id'] === $this->owner->id
            && ! str_contains((string) json_encode($payload), $comment->body_text);
    });
});

it('authorizes the read endpoint like the task, without view-only management', function () {
    commentOn($this->task, $this->owner, '2026-10-07 09:00:00');
    $url = "/tugas/{$this->task->id}/komentar/dibaca";

    $this->actingAs($this->member)->postJson($url)->assertOk()->assertJsonPath('read.user.id', $this->member->id);
    $this->actingAs($this->other)->postJson($url)->assertOk();

    // Outsider: the task does not exist for them.
    $this->actingAs(User::factory()->withRole(Role::Anggota)->create())->postJson($url)->assertNotFound();

    // Direksi sees the workspace in view-only mode: no pointer is kept.
    $direksi = User::factory()->withRole(Role::Direksi)->create();
    $this->actingAs($direksi)->postJson($url)->assertForbidden();
    expect(pointerOf($this->task, $direksi))->toBeNull();

    // Archived workspace: still readable, so reading is still recorded.
    $this->workspace->forceFill(['archived_at' => now()])->save();
    $this->actingAs($this->owner)->postJson($url)->assertOk();

    // Someone else's personal workspace stays closed, even to Super Admin.
    $personal = Workspace::query()->where('type', 'personal')->where('owner_id', $this->owner->id)->firstOrFail();
    $private = app(CreateTask::class)->handle($personal, $this->owner, ['title' => 'Catatan']);
    commentOn($private, $this->owner, '2026-10-07 09:00:00');
    $this->actingAs(User::factory()->withRole(Role::SuperAdmin)->create())
        ->postJson("/tugas/{$private->id}/komentar/dibaca")->assertNotFound();
});

it('lists the read pointers of the people taking part in the task detail', function () {
    $comment = commentOn($this->task, $this->owner, '2026-10-07 09:00:00');
    $mark = app(MarkCommentsRead::class);
    $mark->handle($this->task, $this->member);
    $mark->handle($this->task, $this->other);

    // A pointer of someone who is no longer a member, and a stray one of view-only management.
    $removed = memberWithRole($this->workspace, WorkspaceRole::Member);
    $mark->handle($this->task, $removed);
    WorkspaceMember::query()->where('workspace_id', $this->workspace->id)->where('user_id', $removed->id)->delete();
    $direksi = User::factory()->withRole(Role::Direksi)->create();
    TaskCommentRead::query()->insert(['task_id' => $this->task->id, 'user_id' => $direksi->id, 'last_read_comment_id' => $comment->id, 'last_read_at' => $comment->created_at, 'created_at' => now(), 'updated_at' => now()]);

    $detail = $this->actingAs($this->owner)->getJson("/tugas/{$this->task->id}")->assertOk();

    expect(collect($detail->json('comment_reads'))->pluck('user.id')->sort()->values()->all())
        ->toBe(collect([$this->member->id, $this->other->id])->sort()->values()->all())
        ->and($detail->json('comment_reads.0.last_read_comment_id'))->toBe($comment->id)
        ->and($detail->json('can.track_reads'))->toBeTrue();

    // View-only management may look at the receipts but is not tracked.
    $this->actingAs($direksi)->getJson("/tugas/{$this->task->id}")
        ->assertOk()
        ->assertJsonPath('can.track_reads', false)
        ->assertJsonCount(2, 'comment_reads');
});

it('lists non-members of an internal workspace who read the comments', function () {
    $this->workspace->forceFill(['visibility' => WorkspaceVisibility::Internal])->save();
    $colleague = User::factory()->withRole(Role::Anggota)->create(['company_id' => $this->owner->company_id]);
    commentOn($this->task, $this->owner, '2026-10-07 09:00:00');

    $this->actingAs($colleague)->postJson("/tugas/{$this->task->id}/komentar/dibaca")->assertOk();

    expect(collect(app(TaskDetail::class)->for($this->task, $this->owner)['comment_reads'])->pluck('user.id')->all())
        ->toBe([$colleague->id]);
});

describe('comment badge on cards', function () {
    beforeEach(function () {
        $this->travelTo(now()->startOfMinute());
    });

    $card = fn (Task $task, User $viewer): array => (new TaskResource(BoardTasks::query($viewer)->findOrFail($task->id)))->resolve();

    it('counts comments and shows the unread dot to people involved in the task', function () use ($card) {
        // The owner created the task (watcher); the member is assigned; the other member is neither.
        $this->task->assignees()->attach($this->member->id, ['assigned_at' => now()]);
        commentOn($this->task, $this->other, now()->subHour()->toDateTimeString());
        commentOn($this->task, $this->owner, now()->subMinutes(30)->toDateTimeString());
        commentOn($this->task, $this->other, now()->subMinutes(10)->toDateTimeString(), ['deleted_at' => now()]);

        expect($card($this->task, $this->owner)['comments'])->toBe(['count' => 2, 'unread' => true])
            ->and($card($this->task, $this->member)['comments'])->toBe(['count' => 2, 'unread' => true])
            ->and($card($this->task, $this->other)['comments'])->toBe(['count' => 2, 'unread' => false]);

        app(MarkCommentsRead::class)->handle($this->task, $this->owner);

        // Read up to the newest comment; the owner's own comment never counts.
        expect($card($this->task, $this->owner)['comments'])->toBe(['count' => 2, 'unread' => false])
            ->and($card($this->task, $this->member)['comments']['unread'])->toBeTrue();
    });

    it('ignores comments older than the unread window', function () use ($card) {
        commentOn($this->task, $this->member, now()->subDays(BoardTasks::UNREAD_COMMENT_DAYS + 1)->toDateTimeString());

        expect($card($this->task, $this->owner)['comments'])->toBe(['count' => 1, 'unread' => false]);
    });

    it('omits the badge when the query has no viewer', function () {
        $resource = (new TaskResource(BoardTasks::query()->findOrFail($this->task->id)))->resolve();

        expect($resource)->not->toHaveKey('comments');
    });

    it('sends the badge with the board, card refetch, edit and move responses', function () {
        commentOn($this->task, $this->member, now()->subMinute()->toDateTimeString());
        $expected = ['count' => 1, 'unread' => true];

        $board = $this->actingAs($this->owner)->get('/w/PLQ')->assertOk()->viewData('page')['props']['tasks'];
        expect($board[0]['comments'])->toBe($expected);

        $this->actingAs($this->owner)->getJson("/tugas/{$this->task->id}?view=card")->assertJsonPath('task.comments', $expected);
        $this->actingAs($this->owner)->patchJson("/tugas/{$this->task->id}", ['priority' => 2])->assertJsonPath('task.comments', $expected);
        $this->actingAs($this->owner)->patchJson("/tugas/{$this->task->id}/move", ['status_id' => statusOf($this->workspace, 'in_progress')->id])
            ->assertJsonPath('task.comments', $expected);
    });
});

it('keeps the board and the task detail at a constant number of queries', function () {
    $people = collect(range(1, 3))->map(fn () => memberWithRole($this->workspace, WorkspaceRole::Member));
    $grow = function (int $tasks) use ($people): void {
        foreach (range(1, $tasks) as $i) {
            $task = app(CreateTask::class)->handle($this->workspace, $this->owner, ['title' => "Tugas {$i}", 'assignee_ids' => [$people[$i % 3]->id]]);

            foreach ($people as $person) {
                commentOn($task, $person, now()->subMinutes(5)->toDateTimeString());
                commentOn($this->task, $person, now()->subMinutes(4)->toDateTimeString());
                app(MarkCommentsRead::class)->handle($task, $person);
                app(MarkCommentsRead::class)->handle($this->task, $person);
            }
        }
    };
    $count = function (string $url): int {
        $this->actingAs(User::query()->findOrFail($this->owner->id))->get($url)->assertOk();
        DB::flushQueryLog();
        DB::enableQueryLog();
        $this->actingAs(User::query()->findOrFail($this->owner->id))->get($url)->assertOk();
        $queries = count(DB::getQueryLog());
        DB::disableQueryLog();

        return $queries;
    };

    $grow(2);
    $board = $count('/w/PLQ');
    $detail = $count("/tugas/{$this->task->id}");

    // More tasks, comments and readers (+3 people with a pointer each round).
    $people->push(...collect(range(1, 3))->map(fn () => memberWithRole($this->workspace, WorkspaceRole::Member))->all());
    $grow(4);

    expect($count('/w/PLQ'))->toBeLessThanOrEqual($board)
        ->and($count("/tugas/{$this->task->id}"))->toBeLessThanOrEqual($detail)
        ->and(count(app(TaskDetail::class)->for($this->task, $this->owner)['comment_reads']))->toBe(6);

    // Budgets (measured 42 / 41 + headroom, shared Inertia props included): the
    // card badge adds subqueries, not queries; "Dibaca oleh" adds 2 to the detail.
    expect($board)->toBeLessThanOrEqual(44)
        ->and($detail)->toBeLessThanOrEqual(43);
});
