<?php

use App\Domain\Organization\Enums\Role;
use App\Domain\Tasks\Actions\CreateTask;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Models\Comment;
use App\Models\User;
use App\Models\Workspace;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Gate;

require_once __DIR__.'/../../Support/workspace-helpers.php';

/*
 * CommentPolicy matrix: actor × ability on a comment written by a member
 * of a private project workspace. 'allow' · 'deny' (403) · 'hidden' (404).
 */
beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->owner = User::factory()->create();
    $this->workspace = Workspace::factory()->ownedBy($this->owner)->create(['key' => 'PLQ']);
    $this->author = memberWithRole($this->workspace, WorkspaceRole::Member);
    $this->task = app(CreateTask::class)->handle($this->workspace, $this->owner, ['title' => 'Landing page']);
    $this->comment = Comment::factory()->on($this->task)->by($this->author)->create();
});

function commentActor(string $actor): User
{
    return match ($actor) {
        'author' => test()->author,
        'owner' => test()->owner,
        'admin' => memberWithRole(test()->workspace, WorkspaceRole::Admin),
        'member' => memberWithRole(test()->workspace, WorkspaceRole::Member),
        'viewer' => memberWithRole(test()->workspace, WorkspaceRole::Viewer),
        'direksi' => User::factory()->withRole(Role::Direksi)->create(),
        'super_admin' => User::factory()->withRole(Role::SuperAdmin)->create(),
        'outsider' => User::factory()->create(),
    };
}

function verdict(User $user, string $ability, mixed $arguments): string
{
    $response = Gate::forUser($user)->inspect($ability, $arguments);

    return $response->allowed() ? 'allow' : ($response->status() === 404 ? 'hidden' : 'deny');
}

it('applies the comment matrix', function (string $actor, string $view, string $create, string $update, string $delete, string $react) {
    $user = commentActor($actor);

    expect([
        verdict($user, 'view', $this->comment),
        verdict($user, 'create', [Comment::class, $this->task]),
        verdict($user, 'update', $this->comment),
        verdict($user, 'delete', $this->comment),
        verdict($user, 'react', $this->comment),
    ])->toBe([$view, $create, $update, $delete, $react]);
})->with([
    //            view     create   update   delete   react
    'author' => ['author', 'allow', 'allow', 'allow', 'allow', 'allow'],
    'owner' => ['owner', 'allow', 'allow', 'deny', 'allow', 'allow'],
    'admin' => ['admin', 'allow', 'allow', 'deny', 'allow', 'allow'],
    'member' => ['member', 'allow', 'allow', 'deny', 'deny', 'allow'],
    'viewer' => ['viewer', 'allow', 'allow', 'deny', 'deny', 'allow'],
    // Keputusan pemilik 6 Okt 2026: management outside the workspace only looks.
    'direksi' => ['direksi', 'allow', 'deny', 'deny', 'deny', 'deny'],
    'super admin' => ['super_admin', 'allow', 'deny', 'deny', 'deny', 'deny'],
    'outsider' => ['outsider', 'hidden', 'hidden', 'hidden', 'hidden', 'hidden'],
]);

it('makes everything read-only on an archived workspace', function () {
    $this->workspace->forceFill(['archived_at' => now()])->save();

    expect(verdict($this->author, 'view', $this->comment))->toBe('allow')
        ->and(verdict($this->author, 'update', $this->comment))->toBe('deny')
        ->and(verdict($this->author, 'delete', $this->comment))->toBe('deny')
        ->and(verdict($this->owner, 'create', [Comment::class, $this->task]))->toBe('deny');
});

it('treats deleted comments as gone', function () {
    $this->comment->delete();

    expect(verdict($this->author, 'update', $this->comment))->toBe('hidden')
        ->and(verdict($this->author, 'react', $this->comment))->toBe('hidden');
});
