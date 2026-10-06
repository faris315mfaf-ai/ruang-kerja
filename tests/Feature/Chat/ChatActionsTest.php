<?php

use App\Domain\Chat\Actions\CreateChannel;
use App\Domain\Chat\Actions\DeleteMessage;
use App\Domain\Chat\Actions\EditMessage;
use App\Domain\Chat\Actions\MarkChannelRead;
use App\Domain\Chat\Actions\OpenDirectConversation;
use App\Domain\Chat\Actions\PostMessage;
use App\Domain\Chat\Actions\SetChannelMuted;
use App\Domain\Chat\Actions\SyncWorkspaceChannel;
use App\Domain\Chat\Actions\ToggleMessageReaction;
use App\Domain\Chat\Enums\ChannelRole;
use App\Domain\Chat\Enums\ChannelType;
use App\Domain\Chat\Notifications\ChatMentionNotification;
use App\Domain\Chat\Notifications\DirectMessageNotification;
use App\Domain\Organization\Enums\UserStatus;
use App\Domain\Tasks\Actions\CreateTask;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Events\Chat\ChatActivity;
use App\Events\Chat\MessagePosted;
use App\Events\Workspaces\WorkspaceMembersChanged;
use App\Models\AuditLog;
use App\Models\Channel;
use App\Models\ChannelMember;
use App\Models\DriveFile;
use App\Models\Message;
use App\Models\User;
use App\Models\Workspace;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;

require_once __DIR__.'/../../Support/workspace-helpers.php';

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Notification::fake();
    $this->dimas = User::factory()->create(['name' => 'Dimas Pratama']);
    $this->sari = User::factory()->create(['name' => 'Sari Wulandari']);
    $this->rizky = User::factory()->create(['name' => 'Rizky Aditya']);
});

function chatMember(Channel $channel, User $user): ?ChannelMember
{
    return ChannelMember::query()->where('channel_id', $channel->id)->where('user_id', $user->id)->first();
}

it('creates a public channel with the creator as owner and active colleagues only', function () {
    $inactive = User::factory()->create(['status' => UserStatus::Inactive]);

    $channel = app(CreateChannel::class)->handle($this->dimas, [
        'name' => '  Tim Konten Q4 ',
        'topic' => 'Kalender konten',
        'member_ids' => [$this->sari->id, $inactive->id],
    ]);

    expect($channel->type)->toBe(ChannelType::Public)
        ->and($channel->name)->toBe('tim-konten-q4')
        ->and(chatMember($channel, $this->dimas)?->role)->toBe(ChannelRole::Owner)
        ->and(chatMember($channel, $this->sari)?->role)->toBe(ChannelRole::Member)
        ->and(chatMember($channel, $inactive))->toBeNull();
});

it('reuses the same DM and turns three people into a group', function () {
    $open = app(OpenDirectConversation::class);

    $dm = $open->handle($this->dimas, [$this->sari->id]);
    $again = $open->handle($this->sari, [$this->dimas->id]);
    $group = $open->handle($this->dimas, [$this->sari->id, $this->rizky->id]);

    expect($again->id)->toBe($dm->id)
        ->and($dm->type)->toBe(ChannelType::Dm)
        ->and($group->type)->toBe(ChannelType::Group)
        ->and($group->memberships()->count())->toBe(3)
        ->and(Channel::query()->count())->toBe(2);
});

it('refuses an empty DM', function () {
    app(OpenDirectConversation::class)->handle($this->dimas, [$this->dimas->id]);
})->throws(ValidationException::class);

it('posts a message, keeps mentions only for people who can read the channel, and notifies DM members once until read', function () {
    Event::fake([MessagePosted::class, ChatActivity::class]);
    $outsider = User::factory()->create(['name' => 'Orang Luar']);
    $dm = app(OpenDirectConversation::class)->handle($this->dimas, [$this->sari->id]);
    $post = app(PostMessage::class);

    $first = $post->handle($dm, $this->dimas, richDoc('Halo ', ['@', $this->sari], ' dan ', ['@', $outsider]));

    expect($first->mentions()->pluck('mentioned_user_id')->all())->toBe([$this->sari->id])
        ->and($first->body_text)->toContain('Orang Luar');
    Notification::assertSentTo($this->sari, ChatMentionNotification::class);
    Notification::assertNotSentTo($this->sari, DirectMessageNotification::class); // mentioned already
    Notification::assertNothingSentTo($outsider);
    Event::assertDispatched(MessagePosted::class);
    Event::assertDispatched(ChatActivity::class, fn (ChatActivity $event) => $event->userIds === [$this->sari->id]);

    $post->handle($dm, $this->dimas, richDoc('Pesan kedua'));
    Notification::assertSentToTimes($this->sari, DirectMessageNotification::class, 1);

    expect(chatMember($dm, $this->dimas)?->last_read_message_id)->not->toBeNull();
});

it('does not send "pesan baru" for muted DMs but still notifies mentions', function () {
    $group = app(OpenDirectConversation::class)->handle($this->dimas, [$this->sari->id, $this->rizky->id]);
    app(SetChannelMuted::class)->handle($group, $this->sari, true);

    app(PostMessage::class)->handle($group, $this->dimas, richDoc('Rapat jam 3 ', ['@', $this->sari]));

    Notification::assertSentTo($this->sari, ChatMentionNotification::class);
    Notification::assertNotSentTo($this->sari, DirectMessageNotification::class);
    Notification::assertSentTo($this->rizky, DirectMessageNotification::class);
});

it('sends no "pesan baru" in workspace or public channels', function () {
    $channel = Channel::factory()->publicChannel()->withMembers([$this->dimas, $this->sari])->create();

    app(PostMessage::class)->handle($channel, $this->dimas, richDoc('Info umum'));

    Notification::assertNothingSent();
});

it('turns references to tasks the author cannot see into text', function () {
    $owner = User::factory()->create();
    $hidden = Workspace::factory()->ownedBy($owner)->create(['key' => 'RHS']);
    $task = app(CreateTask::class)->handle($hidden, $owner, ['title' => 'Rahasia']);
    $channel = Channel::factory()->publicChannel()->withMembers([$this->dimas])->create();

    $message = app(PostMessage::class)->handle($channel, $this->dimas, richDoc('Lihat ', ['#', $task]));

    expect(json_encode($message->body))->not->toContain('taskReference');
});

it('joins a public channel when posting in it', function () {
    $channel = Channel::factory()->publicChannel()->withMembers([$this->dimas])->create();

    app(PostMessage::class)->handle($channel, $this->rizky, richDoc('Ikut nimbrung'));

    expect(chatMember($channel, $this->rizky)?->role)->toBe(ChannelRole::Member);
});

it('rejects empty messages and replies to another channel', function () {
    $channel = Channel::factory()->publicChannel()->withMembers([$this->dimas])->create();
    $other = Channel::factory()->publicChannel()->withMembers([$this->dimas])->create();
    $root = Message::factory()->in($other)->by($this->dimas)->create();

    expect(fn () => app(PostMessage::class)->handle($channel, $this->dimas, ['type' => 'doc', 'content' => []]))
        ->toThrow(ValidationException::class)
        ->and(fn () => app(PostMessage::class)->handle($channel, $this->dimas, richDoc('Balas'), [], $root))
        ->toThrow(ValidationException::class);
});

it('attaches Drive files in a DM only when every member can open them', function () {
    $shared = Workspace::factory()->ownedBy($this->dimas)->withMember($this->sari)->create(['key' => 'BRS']);
    $mine = Workspace::factory()->ownedBy($this->dimas)->create(['key' => 'SAYA']);
    $sharedFile = DriveFile::factory()->create(['workspace_id' => $shared->id]);
    $privateFile = DriveFile::factory()->create(['workspace_id' => $mine->id]);
    $dm = app(OpenDirectConversation::class)->handle($this->dimas, [$this->sari->id]);

    $message = app(PostMessage::class)->handle($dm, $this->dimas, null, [$sharedFile->id]);

    expect($message->attachments()->pluck('drive_file_id')->all())->toBe([$sharedFile->id])
        ->and(fn () => app(PostMessage::class)->handle($dm, $this->dimas, richDoc('Ini'), [$privateFile->id]))
        ->toThrow(ValidationException::class);
});

it('edits, reacts and deletes, keeping thread replies', function () {
    $channel = Channel::factory()->publicChannel()->withMembers([$this->dimas, $this->sari])->create();
    $root = app(PostMessage::class)->handle($channel, $this->dimas, richDoc('Usulan awal'));
    $reply = app(PostMessage::class)->handle($channel, $this->sari, richDoc('Setuju'), [], $root);

    app(EditMessage::class)->handle($root, $this->dimas, richDoc('Usulan revisi'));
    expect(app(ToggleMessageReaction::class)->handle($root, $this->sari, '👍'))->toBeTrue()
        ->and(app(ToggleMessageReaction::class)->handle($root, $this->sari, '👍'))->toBeFalse();
    app(ToggleMessageReaction::class)->handle($root, $this->sari, '🎉');

    app(DeleteMessage::class)->handle($root->fresh(), $this->dimas);

    $deleted = Message::withTrashed()->find($root->id);
    expect($deleted->trashed())->toBeTrue()
        ->and($deleted->body)->toBeNull()
        ->and($deleted->body_text)->toBe('')
        ->and($deleted->reactions()->count())->toBe(0)
        ->and(Message::query()->find($reply->id))->not->toBeNull()
        ->and(AuditLog::query()->where('action', 'message.deleted')->count())->toBe(0);
});

it('audits a moderator deleting someone else\'s message', function () {
    $channel = Channel::factory()->publicChannel()->withMembers([$this->dimas, $this->sari])->create();
    $message = Message::factory()->in($channel)->by($this->sari)->create();

    app(DeleteMessage::class)->handle($message, $this->dimas);

    expect(AuditLog::query()->where('action', 'message.deleted')->count())->toBe(1);
});

it('moves the read pointer forward only and clears the channel notifications', function () {
    $dm = app(OpenDirectConversation::class)->handle($this->dimas, [$this->sari->id]);
    $first = Message::factory()->in($dm)->by($this->dimas)->create();
    $second = Message::factory()->in($dm)->by($this->dimas)->create();

    expect(app(MarkChannelRead::class)->handle($dm, $this->sari))->toBe($second->id)
        ->and(app(MarkChannelRead::class)->handle($dm, $this->sari))->toBeNull()
        ->and(chatMember($dm, $this->sari)?->last_read_message_id)->toBe($second->id)
        ->and($first->id < $second->id)->toBeTrue();
});

it('mirrors workspace members into the workspace channel and follows changes', function () {
    $workspace = Workspace::factory()->ownedBy($this->dimas)->create(['key' => 'OPS']);
    addMember($workspace, $this->sari, WorkspaceRole::Admin);

    $channel = app(SyncWorkspaceChannel::class)->handle($workspace);

    expect($channel?->type)->toBe(ChannelType::Workspace)
        ->and(chatMember($channel, $this->dimas)?->role)->toBe(ChannelRole::Owner)
        ->and(chatMember($channel, $this->sari)?->role)->toBe(ChannelRole::Admin);

    $workspace->memberships()->where('user_id', $this->sari->id)->delete();
    addMember($workspace, $this->rizky);
    WorkspaceMembersChanged::dispatch($workspace, [$this->rizky->id], [$this->sari->id]);

    expect(chatMember($channel, $this->sari))->toBeNull()
        ->and(chatMember($channel, $this->rizky)?->role)->toBe(ChannelRole::Member)
        ->and(Channel::query()->where('workspace_id', $workspace->id)->count())->toBe(1);
});

it('never creates a channel for a personal workspace', function () {
    $personal = Workspace::query()->where('type', 'personal')->where('owner_id', $this->dimas->id)->firstOr(
        fn () => Workspace::factory()->personal($this->dimas)->create(),
    );

    expect(app(SyncWorkspaceChannel::class)->handle($personal))->toBeNull();
});

it('syncs every shared workspace from the command', function () {
    Workspace::factory()->ownedBy($this->dimas)->create(['key' => 'AAA']);
    Workspace::factory()->ownedBy($this->dimas)->create(['key' => 'BBB']);
    $this->artisan('chat:sync-workspace-channels')->assertSuccessful();

    expect(Channel::query()->where('type', ChannelType::Workspace)->count())->toBe(2)
        ->and(Workspace::query()->where('type', 'personal')->exists())->toBeTrue();
});
