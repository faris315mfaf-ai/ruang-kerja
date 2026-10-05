<?php

use App\Domain\Organization\Enums\Role;
use App\Domain\Projects\Actions\GiveProjectDirection;
use App\Domain\Projects\Jobs\SendProjectUpdateReminders;
use App\Domain\Projects\Notifications\ProjectDirectionNotification;
use App\Domain\Projects\Notifications\ProjectUpdateReminderNotification;
use App\Domain\Workspaces\Actions\RemoveWorkspaceMember;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Domain\Workspaces\Services\ProjectRolesReleaser;
use App\Models\User;
use App\Models\Workspace;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Notification;

require_once __DIR__.'/../../Support/project-helpers.php';

/*
 * A PIC/sponsor removed from a private project must lose its portfolio entry,
 * reminders and directions.
 */

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->owner = User::factory()->withRole(Role::KepalaDivisi)->create();
    $this->project = makeProject($this->owner);
    $this->pic = memberWithRole($this->project, WorkspaceRole::Admin);
    $this->project->forceFill(['lead_user_id' => $this->pic->id])->save();
});

function portfolioIdsFor(User $user): array
{
    return Workspace::query()->portfolioFor($user)->pluck('id')->all();
}

it('clears the PIC when they are removed from the project', function () {
    expect(portfolioIdsFor($this->pic))->toContain($this->project->id);

    app(RemoveWorkspaceMember::class)->handle($this->project, $this->owner, $this->pic);

    expect($this->project->fresh()->lead_user_id)->toBeNull()
        ->and(portfolioIdsFor($this->pic))->not->toContain($this->project->id);
});

it('keeps a sponsor who still sees the project and clears one who does not', function () {
    $direksi = User::factory()->withRole(Role::Direksi)->create();
    addMember($this->project, $direksi);
    $anggota = memberWithRole($this->project, WorkspaceRole::Member);

    $this->project->forceFill(['sponsor_user_id' => $direksi->id])->save();
    app(RemoveWorkspaceMember::class)->handle($this->project, $this->owner, $direksi);
    expect($this->project->fresh()->sponsor_user_id)->toBe($direksi->id);

    // Legacy/stale row: a sponsor without access.
    $this->project->forceFill(['sponsor_user_id' => $anggota->id])->save();
    app(RemoveWorkspaceMember::class)->handle($this->project, $this->owner, $anggota);
    expect($this->project->fresh()->sponsor_user_id)->toBeNull();
});

it('ignores non-project workspaces and unrelated removals', function () {
    $team = Workspace::factory()->ownedBy($this->owner)->team()->create();

    app(ProjectRolesReleaser::class)->release($team, [$this->pic->id]);
    app(ProjectRolesReleaser::class)->release($this->project, [$this->owner->id]);

    expect($this->project->fresh()->lead_user_id)->toBe($this->pic->id);
});

it('does not list a private project for a stale PIC or sponsor without access', function () {
    $stale = User::factory()->create();
    $this->project->forceFill(['lead_user_id' => $stale->id])->save();
    $staleSponsor = User::factory()->create();
    $other = makeProject($this->owner);
    $other->forceFill(['sponsor_user_id' => $staleSponsor->id])->save();

    expect(portfolioIdsFor($stale))->toBe([])
        ->and(portfolioIdsFor($staleSponsor))->toBe([]);

    $internal = makeProject($this->owner, ['visibility' => 'internal', 'lead_user_id' => $stale->id]);
    expect(portfolioIdsFor($stale))->toBe([$internal->id]);
});

it('does not remind a PIC who lost access', function () {
    Notification::fake();
    $this->travelTo('2026-10-09 08:00:00');
    $stale = User::factory()->create();
    $this->project->forceFill(['lead_user_id' => $stale->id])->save();

    expect(app()->call([new SendProjectUpdateReminders, 'handle']))->toBe(0);
    Notification::assertNotSentTo($stale, ProjectUpdateReminderNotification::class);
});

it('sends directions only to recipients who can see the project', function () {
    Notification::fake();
    $direksi = User::factory()->withRole(Role::Direksi)->create();
    $stale = User::factory()->create();
    $this->project->forceFill(['lead_user_id' => $stale->id])->save();

    app(GiveProjectDirection::class)->handle($this->project->fresh(), $direksi, 'Percepat peluncuran.');

    Notification::assertNotSentTo($stale, ProjectDirectionNotification::class);

    $this->project->forceFill(['lead_user_id' => $this->pic->id])->save();
    app(GiveProjectDirection::class)->handle($this->project->fresh(), $direksi, 'Lanjutkan.');

    Notification::assertSentTo($this->pic, ProjectDirectionNotification::class);
});
