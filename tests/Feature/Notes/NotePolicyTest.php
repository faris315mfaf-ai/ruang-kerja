<?php

use App\Domain\Notes\Enums\NoteShareRole;
use App\Domain\Organization\Enums\Role;
use App\Domain\Organization\Enums\UserStatus;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Domain\Workspaces\Enums\WorkspaceVisibility;
use App\Models\Company;
use App\Models\Note;
use App\Models\NoteShare;
use App\Models\NoteVersion;
use App\Models\User;
use App\Models\Workspace;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Gate;

require_once __DIR__.'/../../Support/workspace-helpers.php';

/*
 * NotePolicy matrix. 'allow' · 'deny' (403) · 'hidden' (404).
 * Decision 11 Oct 2026: restricted notes = author + invited people only — no
 * global role (Direksi, HR, Super Admin) sees them automatically; personal
 * workspaces stay owner-only.
 */
beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->owner = User::factory()->withRole(Role::KepalaDivisi)->create();
    $this->workspace = Workspace::factory()->ownedBy($this->owner)->create(['key' => 'OPS', 'visibility' => WorkspaceVisibility::Private]);
    $this->author = memberWithRole($this->workspace, WorkspaceRole::Member);
    $this->member = memberWithRole($this->workspace, WorkspaceRole::Member);
    $this->viewer = memberWithRole($this->workspace, WorkspaceRole::Viewer);
    $this->admin = memberWithRole($this->workspace, WorkspaceRole::Admin);
    $this->invited = User::factory()->create();
});

function noteActor(string $actor): User
{
    return match ($actor) {
        'owner' => test()->owner,
        'author' => test()->author,
        'member' => test()->member,
        'viewer' => test()->viewer,
        'admin' => test()->admin,
        'invited' => test()->invited,
        'anggota' => User::factory()->withRole(Role::Anggota)->create(),
        'kadiv' => User::factory()->withRole(Role::KepalaDivisi)->create(),
        'hr' => User::factory()->withRole(Role::Hr)->create(),
        'direksi' => User::factory()->withRole(Role::Direksi)->create(),
        'super_admin' => User::factory()->withRole(Role::SuperAdmin)->create(),
        'foreign' => User::factory()->create(['company_id' => Company::factory()->create()->id]),
        'inactive' => addMember(test()->workspace, User::factory()->create(['status' => UserStatus::Inactive]), WorkspaceRole::Member),
    };
}

function personalWorkspaceOf(User $user): Workspace
{
    return Workspace::query()->where('type', 'personal')->where('owner_id', $user->id)->first()
        ?? Workspace::factory()->personal($user)->create();
}

function noteVerdict(User $user, string $ability, mixed $arguments): string
{
    $response = Gate::forUser($user)->inspect($ability, $arguments);

    return $response->allowed() ? 'allow' : ($response->status() === 404 ? 'hidden' : 'deny');
}

function policyNote(string $access): Note
{
    $factory = Note::factory()->in(test()->workspace)->by(test()->author);
    $note = ($access === 'restricted' ? $factory->restricted() : $factory)->create();
    NoteShare::factory()->create(['note_id' => $note->id, 'user_id' => test()->invited->id, 'role' => NoteShareRole::View]);

    return $note;
}

it('applies the note matrix', function (string $access, string $actor, string $view, string $update, string $share, string $delete) {
    $note = policyNote($access);
    $user = noteActor($actor);

    expect([
        noteVerdict($user, 'view', $note),
        noteVerdict($user, 'update', $note),
        noteVerdict($user, 'share', $note),
        noteVerdict($user, 'delete', $note),
    ])->toBe([$view, $update, $share, $delete]);
})->with([
    //                                         view     update   share    delete
    'workspace · author' => ['workspace', 'author', 'allow', 'allow', 'allow', 'allow'],
    'workspace · member' => ['workspace', 'member', 'allow', 'allow', 'deny', 'deny'],
    'workspace · ws viewer' => ['workspace', 'viewer', 'allow', 'deny', 'deny', 'deny'],
    'workspace · ws admin' => ['workspace', 'admin', 'allow', 'allow', 'allow', 'allow'],
    'workspace · ws owner' => ['workspace', 'owner', 'allow', 'allow', 'allow', 'allow'],
    'workspace · invited (view)' => ['workspace', 'invited', 'allow', 'deny', 'deny', 'deny'],
    'workspace · anggota' => ['workspace', 'anggota', 'hidden', 'hidden', 'hidden', 'hidden'],
    'workspace · kadiv' => ['workspace', 'kadiv', 'hidden', 'hidden', 'hidden', 'hidden'],
    'workspace · hr' => ['workspace', 'hr', 'allow', 'deny', 'deny', 'deny'], // HR reads every shared workspace (keputusan pemilik 6 Okt 2026)
    'workspace · direksi' => ['workspace', 'direksi', 'allow', 'deny', 'deny', 'deny'],
    'workspace · super admin' => ['workspace', 'super_admin', 'allow', 'deny', 'deny', 'deny'],
    'workspace · other company' => ['workspace', 'foreign', 'hidden', 'hidden', 'hidden', 'hidden'],
    'workspace · inactive member' => ['workspace', 'inactive', 'hidden', 'hidden', 'hidden', 'hidden'],
    'restricted · author' => ['restricted', 'author', 'allow', 'allow', 'allow', 'allow'],
    'restricted · invited (view)' => ['restricted', 'invited', 'allow', 'deny', 'deny', 'deny'],
    'restricted · member' => ['restricted', 'member', 'hidden', 'hidden', 'hidden', 'hidden'],
    'restricted · ws admin' => ['restricted', 'admin', 'hidden', 'hidden', 'hidden', 'hidden'],
    'restricted · ws owner' => ['restricted', 'owner', 'hidden', 'hidden', 'hidden', 'hidden'],
    'restricted · direksi' => ['restricted', 'direksi', 'hidden', 'hidden', 'hidden', 'hidden'],
    'restricted · hr' => ['restricted', 'hr', 'hidden', 'hidden', 'hidden', 'hidden'],
    'restricted · super admin' => ['restricted', 'super_admin', 'hidden', 'hidden', 'hidden', 'hidden'],
    'restricted · other company' => ['restricted', 'foreign', 'hidden', 'hidden', 'hidden', 'hidden'],
]);

it('lets an edit invitation edit a restricted note', function () {
    $note = policyNote('restricted');
    NoteShare::query()->where('note_id', $note->id)->update(['role' => NoteShareRole::Edit->value]);

    expect(noteVerdict($this->invited, 'update', $note->fresh()))->toBe('allow')
        ->and(noteVerdict($this->invited, 'share', $note->fresh()))->toBe('deny');
});

it('lets a share downgrade a workspace member to reading', function () {
    $note = policyNote('workspace');
    NoteShare::factory()->create(['note_id' => $note->id, 'user_id' => $this->member->id, 'role' => NoteShareRole::View]);

    expect(noteVerdict($this->member, 'view', $note))->toBe('allow')
        ->and(noteVerdict($this->member, 'update', $note))->toBe('deny');
});

it('keeps personal notes to the owner, even when shared', function () {
    $personal = personalWorkspaceOf($this->member);
    $note = Note::factory()->in($personal)->by($this->member)->create();
    NoteShare::factory()->create(['note_id' => $note->id, 'user_id' => $this->invited->id, 'role' => NoteShareRole::Edit]);

    expect(noteVerdict($this->member, 'view', $note))->toBe('allow')
        ->and(noteVerdict($this->member, 'update', $note))->toBe('allow')
        ->and(noteVerdict($this->member, 'share', $note))->toBe('deny')
        ->and(noteVerdict($this->member, 'delete', $note))->toBe('allow');

    foreach (['invited', 'direksi', 'super_admin', 'hr', 'owner'] as $actor) {
        expect(noteVerdict(noteActor($actor), 'view', $note))->toBe('hidden', $actor);
    }

    expect(Note::query()->visibleTo($this->invited)->count())->toBe(0);
});

it('makes notes of an archived workspace read-only', function () {
    $note = policyNote('workspace');
    $this->workspace->forceFill(['archived_at' => now()])->save();
    $note->refresh();

    expect(noteVerdict($this->author, 'view', $note))->toBe('allow')
        ->and(noteVerdict($this->author, 'update', $note))->toBe('deny')
        ->and(noteVerdict($this->author, 'delete', $note))->toBe('deny')
        ->and(noteVerdict($this->author, 'create', [Note::class, $this->workspace->fresh()]))->toBe('deny');
});

it('hides notes of a deleted workspace and deleted notes', function () {
    $note = policyNote('workspace');
    $gone = policyNote('workspace');
    $gone->delete();
    $this->workspace->delete();

    expect(noteVerdict($this->author, 'view', $note->fresh()))->toBe('hidden')
        ->and(noteVerdict($this->author, 'view', Note::withTrashed()->find($gone->id)))->toBe('hidden');
});

it('lets members who edit tasks create notes', function (string $actor, string $verdict) {
    expect(noteVerdict(noteActor($actor), 'create', [Note::class, $this->workspace]))->toBe($verdict);
})->with([
    ['member', 'allow'],
    ['admin', 'allow'],
    ['viewer', 'deny'],
    ['direksi', 'deny'],
    ['anggota', 'hidden'],
    ['foreign', 'hidden'],
]);

it('lists exactly the notes the policy lets a user see', function () {
    $notes = collect([
        policyNote('workspace'),
        policyNote('restricted'),
        Note::factory()->in(personalWorkspaceOf($this->member))->by($this->member)->create(),
        Note::factory()->in(Workspace::factory()->ownedBy($this->owner)->create(['key' => 'INT', 'visibility' => WorkspaceVisibility::Internal]))->by($this->owner)->restricted()->create(),
        Note::factory()->in(Workspace::factory()->ownedBy($this->owner)->create(['key' => 'IN2', 'visibility' => WorkspaceVisibility::Internal]))->by($this->owner)->create(),
    ]);

    foreach (['owner', 'author', 'member', 'viewer', 'admin', 'invited', 'anggota', 'kadiv', 'hr', 'direksi', 'super_admin', 'foreign', 'inactive'] as $actor) {
        $user = noteActor($actor);
        $expected = $notes->filter(fn (Note $note) => Gate::forUser($user)->allows('view', $note))->pluck('id')->sort()->values()->all();

        expect(Note::query()->visibleTo($user)->pluck('id')->sort()->values()->all())->toBe($expected, $actor);
    }
});

it('follows the note for versions and shares', function () {
    $note = policyNote('restricted');
    $version = NoteVersion::factory()->of($note)->create();
    $share = NoteShare::query()->where('note_id', $note->id)->firstOrFail();

    expect(noteVerdict($this->author, 'view', $version))->toBe('allow')
        ->and(noteVerdict($this->author, 'restore', $version))->toBe('allow')
        ->and(noteVerdict($this->invited, 'view', $version))->toBe('allow')
        ->and(noteVerdict($this->invited, 'restore', $version))->toBe('deny')
        ->and(noteVerdict($this->member, 'view', $version))->toBe('hidden')
        ->and(noteVerdict($this->author, 'update', $share))->toBe('allow')
        ->and(noteVerdict($this->invited, 'view', $share))->toBe('allow')
        ->and(noteVerdict($this->invited, 'delete', $share))->toBe('deny')
        ->and(noteVerdict(noteActor('direksi'), 'view', $share))->toBe('hidden');
});
