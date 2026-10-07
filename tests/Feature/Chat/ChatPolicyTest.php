<?php

use App\Domain\Organization\Enums\Role;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Models\Channel;
use App\Models\Company;
use App\Models\Message;
use App\Models\User;
use App\Models\Workspace;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Gate;

require_once __DIR__.'/../../Support/workspace-helpers.php';

/*
 * ChannelPolicy / MessagePolicy matrices. 'allow' · 'deny' (403) · 'hidden' (404).
 * Decision 6 Oct 2026: private channels, DMs and groups are members only —
 * no global role (Direksi, HR, Super Admin) reads them.
 */
beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->owner = User::factory()->create();
    $this->workspace = Workspace::factory()->ownedBy($this->owner)->create(['key' => 'PLQ']);
    $this->member = memberWithRole($this->workspace, WorkspaceRole::Member);
    $this->other = User::factory()->create();
});

function chatActor(string $actor): User
{
    return match ($actor) {
        'owner' => test()->owner,
        'member' => test()->member,
        'other' => test()->other,
        'admin' => memberWithRole(test()->workspace, WorkspaceRole::Admin),
        'direksi' => User::factory()->withRole(Role::Direksi)->create(),
        'hr' => User::factory()->withRole(Role::Hr)->create(),
        'super_admin' => User::factory()->withRole(Role::SuperAdmin)->create(),
        'outsider' => User::factory()->create(),
        'foreign' => User::factory()->create(['company_id' => Company::factory()->create()->id]),
    };
}

function chatVerdict(User $user, string $ability, mixed $arguments): string
{
    $response = Gate::forUser($user)->inspect($ability, $arguments);

    return $response->allowed() ? 'allow' : ($response->status() === 404 ? 'hidden' : 'deny');
}

function chatChannel(string $type): Channel
{
    return match ($type) {
        'workspace' => Channel::factory()->forWorkspace(test()->workspace)->create(),
        'public' => Channel::factory()->publicChannel()->withMembers([test()->owner, test()->member])->create(),
        'private' => Channel::factory()->privateChannel()->withMembers([test()->owner, test()->member])->create(),
        'dm' => Channel::factory()->direct([test()->owner, test()->member])->create(),
        'group' => Channel::factory()->direct([test()->owner, test()->member, test()->other])->create(),
    };
}

it('applies the channel matrix', function (string $type, string $actor, string $view, string $post, string $manage) {
    $channel = chatChannel($type);
    $user = chatActor($actor);

    expect([
        chatVerdict($user, 'view', $channel),
        chatVerdict($user, 'post', $channel),
        chatVerdict($user, 'manage', $channel),
    ])->toBe([$view, $post, $manage]);
})->with([
    //                                   view     post     manage
    'workspace · owner' => ['workspace', 'owner', 'allow', 'allow', 'allow'],
    'workspace · admin' => ['workspace', 'admin', 'allow', 'allow', 'allow'],
    'workspace · member' => ['workspace', 'member', 'allow', 'allow', 'deny'],
    'workspace · direksi' => ['workspace', 'direksi', 'allow', 'deny', 'deny'],
    'workspace · super admin' => ['workspace', 'super_admin', 'allow', 'deny', 'allow'],
    // Keputusan pemilik 6 Okt 2026: HR reads every shared workspace (view only), like Direksi.
    'workspace · hr' => ['workspace', 'hr', 'allow', 'deny', 'deny'],
    'workspace · outsider' => ['workspace', 'outsider', 'hidden', 'hidden', 'hidden'],
    'public · owner' => ['public', 'owner', 'allow', 'allow', 'allow'],
    'public · member' => ['public', 'member', 'allow', 'allow', 'deny'],
    'public · outsider' => ['public', 'outsider', 'allow', 'allow', 'deny'],
    'public · foreign company' => ['public', 'foreign', 'hidden', 'hidden', 'hidden'],
    'private · owner' => ['private', 'owner', 'allow', 'allow', 'allow'],
    'private · member' => ['private', 'member', 'allow', 'allow', 'deny'],
    'private · direksi' => ['private', 'direksi', 'hidden', 'hidden', 'hidden'],
    'private · hr' => ['private', 'hr', 'hidden', 'hidden', 'hidden'],
    'private · super admin' => ['private', 'super_admin', 'hidden', 'hidden', 'hidden'],
    'dm · participant' => ['dm', 'member', 'allow', 'allow', 'deny'],
    'dm · other participant' => ['dm', 'owner', 'allow', 'allow', 'deny'],
    'dm · direksi' => ['dm', 'direksi', 'hidden', 'hidden', 'hidden'],
    'dm · super admin' => ['dm', 'super_admin', 'hidden', 'hidden', 'hidden'],
    'group · participant' => ['group', 'other', 'allow', 'allow', 'deny'],
    'group · outsider' => ['group', 'outsider', 'hidden', 'hidden', 'hidden'],
]);

it('lists exactly the channels the policy lets a user see', function () {
    $channels = collect(['workspace', 'public', 'private', 'dm', 'group'])->mapWithKeys(fn (string $type) => [$type => chatChannel($type)]);

    foreach (['owner', 'member', 'other', 'direksi', 'hr', 'super_admin', 'outsider', 'foreign'] as $actor) {
        $user = chatActor($actor);
        $expected = $channels->filter(fn (Channel $channel) => Gate::forUser($user)->allows('view', $channel))->pluck('id')->sort()->values()->all();

        expect(Channel::query()->visibleTo($user)->pluck('id')->sort()->values()->all())->toBe($expected, $actor);
    }
});

it('makes archived channels and archived workspaces read-only', function () {
    $workspaceChannel = chatChannel('workspace');
    $public = chatChannel('public');

    $this->workspace->forceFill(['archived_at' => now()])->save();
    $public->forceFill(['archived_at' => now()])->save();

    expect(chatVerdict($this->member, 'view', $workspaceChannel->fresh()))->toBe('allow')
        ->and(chatVerdict($this->member, 'post', $workspaceChannel->fresh()))->toBe('deny')
        ->and(chatVerdict($this->member, 'view', $public))->toBe('allow')
        ->and(chatVerdict($this->member, 'post', $public))->toBe('deny');
});

it('hides the channel of a workspace that is gone', function () {
    $channel = chatChannel('workspace');
    $this->workspace->delete();

    expect(chatVerdict($this->owner, 'view', $channel->fresh()))->toBe('hidden');
});

it('applies the message matrix on a workspace channel', function (string $actor, string $view, string $update, string $delete, string $react) {
    $channel = chatChannel('workspace');
    $message = Message::factory()->in($channel)->by($this->member)->create();
    $user = $actor === 'author' ? $this->member : chatActor($actor);

    expect([
        chatVerdict($user, 'view', $message),
        chatVerdict($user, 'update', $message),
        chatVerdict($user, 'delete', $message),
        chatVerdict($user, 'react', $message),
    ])->toBe([$view, $update, $delete, $react]);
})->with([
    //                       view     update   delete   react
    'author' => ['author', 'allow', 'allow', 'allow', 'allow'],
    'owner' => ['owner', 'allow', 'deny', 'allow', 'allow'],
    'admin' => ['admin', 'allow', 'deny', 'allow', 'allow'],
    'other member' => ['other', 'hidden', 'hidden', 'hidden', 'hidden'],
    'direksi' => ['direksi', 'allow', 'deny', 'deny', 'deny'],
    'outsider' => ['outsider', 'hidden', 'hidden', 'hidden', 'hidden'],
]);

it('lets DM participants moderate only their own messages', function () {
    $channel = chatChannel('dm');
    $message = Message::factory()->in($channel)->by($this->member)->create();

    expect(chatVerdict($this->member, 'delete', $message))->toBe('allow')
        ->and(chatVerdict($this->owner, 'delete', $message))->toBe('deny')
        ->and(chatVerdict($this->owner, 'react', $message))->toBe('allow');
});

it('treats deleted messages as gone for changes', function () {
    $channel = chatChannel('public');
    $message = Message::factory()->in($channel)->by($this->member)->create();
    $message->delete();

    expect(chatVerdict($this->member, 'update', $message))->toBe('hidden')
        ->and(chatVerdict($this->member, 'react', $message))->toBe('hidden')
        ->and(chatVerdict($this->member, 'view', $message))->toBe('allow');
});
