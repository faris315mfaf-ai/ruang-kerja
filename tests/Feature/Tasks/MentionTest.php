<?php

use App\Domain\Organization\Enums\Role;
use App\Domain\Tasks\Actions\CreateTask;
use App\Domain\Tasks\Actions\PostComment;
use App\Domain\Tasks\Actions\UpdateComment;
use App\Domain\Tasks\Actions\UpdateTask;
use App\Domain\Tasks\Notifications\MentionNotification;
use App\Domain\Tasks\Notifications\TaskCommentedNotification;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Models\InboxNotification;
use App\Models\Mention;
use App\Models\User;
use App\Models\Workspace;
use Database\Seeders\RoleSeeder;
use Illuminate\Notifications\ChannelManager;
use Illuminate\Support\Facades\Notification;

require_once __DIR__.'/../../Support/workspace-helpers.php';

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->owner = User::factory()->create(['name' => 'Sari Wulandari']);
    $this->private = Workspace::factory()->ownedBy($this->owner)->create(['key' => 'SEC']);
    $this->member = memberWithRole($this->private, WorkspaceRole::Member);
    $this->outsider = User::factory()->create(['name' => 'Orang Luar']);
    $this->task = app(CreateTask::class)->handle($this->private, $this->owner, ['title' => 'Negosiasi kontrak rahasia']);
});

it('notifies mentioned people who can see the workspace', function () {
    Notification::fake();

    $comment = app(PostComment::class)->handle($this->task, $this->owner, richDoc(['@', $this->member], ' mohon cek angka di paragraf 2'));

    Notification::assertSentTo($this->member, MentionNotification::class, function (MentionNotification $n) use ($comment) {
        $payload = $n->payload($this->member);

        return $payload->title === 'Sari Wulandari menyebut Anda di SEC-1'
            && $payload->body === "@{$this->member->name} mohon cek angka di paragraf 2"
            && $payload->url === '/w/SEC/tasks/1#komentar-'.$comment->id
            && $payload->subject?->code === 'SEC-1';
    });
    // Mentioned people are not notified twice ("mengomentari").
    Notification::assertNotSentTo($this->member, TaskCommentedNotification::class);

    expect(Mention::query()->where('mentionable_id', $comment->id)->pluck('mentioned_user_id')->all())->toBe([$this->member->id]);
});

it('does not leak a private workspace to a mentioned outsider', function () {
    Notification::fake();

    $comment = app(PostComment::class)->handle($this->task, $this->owner, richDoc(['@', $this->outsider], ' tolong lihat ini'));

    Notification::assertNothingSentTo($this->outsider);
    expect(Mention::query()->count())->toBe(0)
        // The node becomes plain text: no link to the person, no record.
        ->and($comment->body['content'][0]['content'][0])->toBe(['type' => 'text', 'text' => '@Orang Luar']);

    // Real delivery: nothing in the outsider's Inbox either.
    Notification::swap(app(ChannelManager::class));
    app(PostComment::class)->handle($this->task, $this->owner, richDoc(['@', $this->outsider], ' sekali lagi'));
    expect(InboxNotification::query()->where('notifiable_id', $this->outsider->id)->count())->toBe(0);
});

it('skips inactive people and people mentioned in someone else\'s personal workspace', function () {
    Notification::fake();
    $inactive = addMember($this->private, User::factory()->create(['status' => 'inactive']));
    $personal = Workspace::query()->where('type', 'personal')->where('owner_id', $this->owner->id)->firstOrFail();
    $note = app(CreateTask::class)->handle($personal, $this->owner, ['title' => 'Catatan pribadi']);

    app(PostComment::class)->handle($this->task, $this->owner, richDoc(['@', $inactive]));
    app(PostComment::class)->handle($note, $this->owner, richDoc(['@', $this->member]));

    Notification::assertNothingSentTo($inactive);
    Notification::assertNothingSentTo($this->member);
    expect(Mention::query()->count())->toBe(0);
});

it('allows mentioning any employee in an internal workspace and Direksi anywhere shared', function () {
    Notification::fake();
    $internal = Workspace::factory()->ownedBy($this->owner)->internal()->create(['key' => 'INT']);
    $task = app(CreateTask::class)->handle($internal, $this->owner, ['title' => 'Pengumuman']);
    $direksi = User::factory()->withRole(Role::Direksi)->create();

    app(PostComment::class)->handle($task, $this->owner, richDoc(['@', $this->outsider]));
    app(PostComment::class)->handle($this->task, $this->owner, richDoc(['@', $direksi]));

    Notification::assertSentTo($this->outsider, MentionNotification::class);
    Notification::assertSentTo($direksi, MentionNotification::class);
});

it('never notifies the author about their own mention', function () {
    Notification::fake();

    app(PostComment::class)->handle($this->task, $this->owner, richDoc(['@', $this->owner], ' catatan untuk diri sendiri'));

    Notification::assertNothingSentTo($this->owner);
    expect(Mention::query()->where('mentioned_user_id', $this->owner->id)->exists())->toBeTrue();
});

it('notifies only newly mentioned people when a comment is edited', function () {
    Notification::fake();
    $second = memberWithRole($this->private, WorkspaceRole::Member);

    $comment = app(PostComment::class)->handle($this->task, $this->owner, richDoc(['@', $this->member]));
    app(UpdateComment::class)->handle($comment, $this->owner, richDoc(['@', $this->member], ' dan ', ['@', $second]));
    app(UpdateComment::class)->handle($comment->fresh(), $this->owner, richDoc(['@', $second]));

    Notification::assertSentToTimes($this->member, MentionNotification::class, 1);
    Notification::assertSentToTimes($second, MentionNotification::class, 1);
    expect(Mention::query()->where('mentionable_id', $comment->id)->pluck('mentioned_user_id')->all())->toBe([$second->id])
        ->and($comment->fresh()?->edited_at)->not->toBeNull();
});

it('records mentions in a task description and notifies once', function () {
    Notification::fake();

    $this->actingAs($this->owner)
        ->patchJson("/tugas/{$this->task->id}", ['description' => richDoc('Koordinasi dengan ', ['@', $this->member], ' dan ', ['@', $this->outsider])])
        ->assertOk();

    app(UpdateTask::class)->handle($this->task->fresh(), $this->owner, ['description' => richDoc('Koordinasi dengan ', ['@', $this->member], '!')]);

    Notification::assertSentToTimes($this->member, MentionNotification::class, 1);
    Notification::assertNotSentTo($this->outsider, MentionNotification::class);

    $task = $this->task->fresh();
    expect($task?->description_text)->toBe("Koordinasi dengan @{$this->member->name}!")
        ->and($task?->mentions()->pluck('mentioned_user_id')->all())->toBe([$this->member->id]);
});

it('suggests only people who can access the workspace', function () {
    $this->actingAs($this->member)
        ->getJson('/w/SEC/rujukan?type=people&q=')
        ->assertOk()
        ->assertJsonCount(2, 'people')
        ->assertJsonMissing(['name' => 'Orang Luar']);

    $this->actingAs($this->outsider)->getJson('/w/SEC/rujukan?type=people')->assertNotFound();
});

it('suggests #references only among tasks the viewer can see', function () {
    $hidden = Workspace::factory()->create(['key' => 'HID']);
    app(CreateTask::class)->handle($hidden, $hidden->owner, ['title' => 'Negosiasi tersembunyi']);

    $this->actingAs($this->member)
        ->getJson('/w/SEC/rujukan?type=tasks&q=negosiasi')
        ->assertOk()
        ->assertJsonCount(1, 'tasks')
        ->assertJsonPath('tasks.0.key', 'SEC-1');

    $this->actingAs($this->member)->getJson('/w/SEC/rujukan?type=tasks&q=1')->assertJsonPath('tasks.0.key', 'SEC-1');
});
