<?php

use App\Domain\Tasks\Actions\CreateTask;
use App\Domain\Tasks\Actions\ToggleReaction;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Models\Comment;
use App\Models\Mention;
use App\Models\Reaction;
use App\Models\User;
use App\Models\Workspace;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Gate;

require_once __DIR__.'/../../Support/workspace-helpers.php';

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->owner = User::factory()->create();
    $this->workspace = Workspace::factory()->ownedBy($this->owner)->create();
    $this->member = memberWithRole($this->workspace, WorkspaceRole::Member);
    $task = app(CreateTask::class)->handle($this->workspace, $this->owner, ['title' => 'Tugas']);
    $this->comment = Comment::factory()->on($task)->by($this->owner)->create();
});

it('lets only the reacting person remove a reaction; outsiders do not see it', function () {
    app(ToggleReaction::class)->handle($this->comment, $this->member, '👍');
    $reaction = Reaction::query()->firstOrFail();

    expect(Gate::forUser($this->member)->allows('delete', $reaction))->toBeTrue()
        ->and(Gate::forUser($this->owner)->inspect('delete', $reaction)->status())->toBeNull()
        ->and(Gate::forUser($this->owner)->allows('delete', $reaction))->toBeFalse()
        ->and(Gate::forUser($this->owner)->allows('view', $reaction))->toBeTrue()
        ->and(Gate::forUser(User::factory()->create())->inspect('view', $reaction)->status())->toBe(404);
});

it('shows a mention only to the mentioned person', function () {
    $mention = Mention::query()->create([
        'mentionable_type' => $this->comment->getMorphClass(),
        'mentionable_id' => $this->comment->id,
        'mentioned_user_id' => $this->member->id,
        'created_by' => $this->owner->id,
    ]);

    expect(Gate::forUser($this->member)->allows('view', $mention))->toBeTrue()
        ->and(Gate::forUser($this->owner)->allows('view', $mention))->toBeFalse()
        ->and(Mention::query()->visibleTo($this->member)->count())->toBe(1)
        ->and(Mention::query()->visibleTo($this->owner)->count())->toBe(0);
});
