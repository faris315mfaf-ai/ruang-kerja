<?php

use App\Domain\Organization\Enums\Role;
use App\Domain\Projects\Actions\RequestProjectUpdate;
use App\Domain\Projects\Actions\ResolveProjectDecision;
use App\Domain\Projects\Notifications\ProjectDecisionResolvedNotification;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Models\Activity;
use App\Models\AuditLog;
use App\Models\ProjectUpdate;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;

require_once __DIR__.'/../../Support/project-helpers.php';

/*
 * Double clicks / concurrent requests: the second one must not repeat side
 * effects (activity, audit, notification).
 */

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Notification::fake();
    $this->owner = User::factory()->withRole(Role::KepalaDivisi)->create();
    $this->direksi = User::factory()->withRole(Role::Direksi)->create();
    $this->project = makeProject($this->owner);
    $this->pic = memberWithRole($this->project, WorkspaceRole::Member);
    $this->project->forceFill(['lead_user_id' => $this->pic->id])->save();
});

it('resolves a decision once even when two requests saw it open', function () {
    $update = ProjectUpdate::factory()->for($this->project, 'workspace')->withDecision()->create(['author_id' => $this->pic->id]);
    // Both requests loaded the update before either saved.
    $first = ProjectUpdate::query()->findOrFail($update->id);
    $second = ProjectUpdate::query()->findOrFail($update->id);
    $otherDireksi = User::factory()->withRole(Role::Direksi)->create();

    app(ResolveProjectDecision::class)->handle($first, $this->direksi);
    $result = app(ResolveProjectDecision::class)->handle($second, $otherDireksi);

    expect($result->decision_resolved_by)->toBe($this->direksi->id)
        ->and(Activity::query()->where('event', 'project.decision_resolved')->count())->toBe(1)
        ->and(AuditLog::query()->where('action', 'project.decision_resolved')->count())->toBe(1);
    Notification::assertSentToTimes($this->pic, ProjectDecisionResolvedNotification::class, 1);
});

it('claims the update-request cooldown under a row lock', function () {
    DB::enableQueryLog();

    app(RequestProjectUpdate::class)->handle($this->project, $this->direksi);

    $locks = collect(DB::getQueryLog())->pluck('query')
        ->filter(fn (string $sql) => str_contains($sql, 'from "workspaces"') && str_contains($sql, 'for update'));

    expect($locks)->not->toBeEmpty()
        ->and(fn () => app(RequestProjectUpdate::class)->handle($this->project, $this->direksi))
        ->toThrow(ValidationException::class);
});
