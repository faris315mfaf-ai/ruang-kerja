<?php

use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Organization\Enums\Role;
use App\Domain\Projects\Actions\PostProjectUpdate;
use App\Domain\Projects\Enums\ProjectHealth;
use App\Domain\Projects\Notifications\ProjectDecisionNeededNotification;
use App\Domain\Projects\Notifications\ProjectDecisionResolvedNotification;
use App\Domain\Projects\Notifications\ProjectDirectionNotification;
use App\Domain\Projects\Notifications\ProjectUpdateRequestedNotification;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Models\Activity;
use App\Models\AuditLog;
use App\Models\Division;
use App\Models\InboxNotification;
use App\Models\Milestone;
use App\Models\ProjectDirection;
use App\Models\ProjectRisk;
use App\Models\ProjectUpdate;
use App\Models\Task;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Notification;

require_once __DIR__.'/../../Support/project-helpers.php';

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->travelTo('2026-10-05 03:00:00');

    $this->owner = User::factory()->withRole(Role::KepalaDivisi)->create();
    $this->direksi = User::factory()->withRole(Role::Direksi)->create(['name' => 'Hendra Wijaya']);
    $this->project = makeProject($this->owner, ['key' => 'PLQ', 'name' => 'Proyek Peluncuran Q4', 'sponsor_user_id' => $this->direksi->id]);
    $this->pic = memberWithRole($this->project, WorkspaceRole::Member, Role::KepalaDivisi);
    $this->project->forceFill(['lead_user_id' => $this->pic->id])->save();
});

describe('Update proyek', function () {
    it('stores the update, progress snapshot and denormalized health', function () {
        projectTasks($this->project, 'done', 1);
        projectTasks($this->project, 'todo', 3);

        $this->actingAs($this->pic)->post('/w/PLQ/update-proyek', [
            'health' => 'at_risk',
            'summary' => ' Landing page 4/7 bagian. ',
            'blockers' => 'Siaran pers tertahan.',
            'decision_needed' => '',
        ])->assertRedirect()->assertSessionHasNoErrors();

        $update = ProjectUpdate::query()->sole();
        $project = $this->project->fresh();

        expect($update->health)->toBe(ProjectHealth::AtRisk)
            ->and($update->summary)->toBe('Landing page 4/7 bagian.')
            ->and($update->decision_needed)->toBeNull()
            ->and((float) $update->progress_snapshot)->toBe(25.0)
            ->and((float) $update->planned_snapshot)->toBe(60.71)
            ->and($project->health)->toBe(ProjectHealth::AtRisk)
            ->and($project->last_update_at?->equalTo(now()))->toBeTrue()
            ->and(Activity::query()->where('event', 'project.update_posted')->exists())->toBeTrue();
    });

    it('validates the form', function () {
        $this->actingAs($this->pic)->post('/w/PLQ/update-proyek', ['health' => 'great', 'summary' => ''])
            ->assertSessionHasErrors(['health', 'summary']);
    });

    it('asks the sponsor for a decision, or every Direksi without a sponsor', function () {
        Notification::fake();
        $otherDireksi = User::factory()->withRole(Role::Direksi)->create();

        app(PostProjectUpdate::class)->handle($this->project, $this->pic, ['health' => ProjectHealth::AtRisk, 'summary' => 'x', 'decision_needed' => 'Tambahan anggaran vendor video.']);
        Notification::assertSentTo($this->direksi, ProjectDecisionNeededNotification::class);
        Notification::assertNotSentTo($otherDireksi, ProjectDecisionNeededNotification::class);

        $this->project->forceFill(['sponsor_user_id' => null])->save();
        app(PostProjectUpdate::class)->handle($this->project, $this->pic, ['health' => ProjectHealth::AtRisk, 'summary' => 'y', 'decision_needed' => 'Lagi.']);
        Notification::assertSentTo($otherDireksi, ProjectDecisionNeededNotification::class);
    });

    it('resolves a pending "Minta update" when the PIC posts', function () {
        $this->actingAs($this->direksi)->post('/w/PLQ/minta-update')->assertRedirect();

        $pending = InboxNotification::query()->where('type', NotificationType::ProjectUpdateRequested->value)->sole();
        expect($pending->notifiable_id)->toBe($this->pic->id)->and($pending->resolved_at)->toBeNull();

        app(PostProjectUpdate::class)->handle($this->project, $this->pic, ['health' => ProjectHealth::OnTrack, 'summary' => 'Sudah.']);

        expect($pending->fresh()?->resolved_at)->not->toBeNull();
    });
});

describe('Direksi actions', function () {
    it('sends "Minta update" to the PIC once per 12 hours', function () {
        Notification::fake();

        $this->actingAs($this->direksi)->post('/w/PLQ/minta-update', ['note' => 'Mohon update sebelum rapat.'])->assertRedirect()->assertSessionHasNoErrors();
        Notification::assertSentTo($this->pic, ProjectUpdateRequestedNotification::class, fn ($notification) => $notification->note === 'Mohon update sebelum rapat.');

        $this->actingAs($this->direksi)->post('/w/PLQ/minta-update')->assertSessionHasErrors('note');
        Notification::assertSentToTimes($this->pic, ProjectUpdateRequestedNotification::class, 1);

        $this->travel(13)->hours();
        $this->actingAs($this->direksi)->post('/w/PLQ/minta-update')->assertSessionHasNoErrors();
        Notification::assertSentToTimes($this->pic, ProjectUpdateRequestedNotification::class, 2);
    });

    it('falls back to the owner when the project has no PIC', function () {
        Notification::fake();
        $this->project->forceFill(['lead_user_id' => null])->save();

        $this->actingAs($this->direksi)->post('/w/PLQ/minta-update')->assertRedirect();

        Notification::assertSentTo($this->owner, ProjectUpdateRequestedNotification::class);
    });

    it('gives a direction to the PIC and the update author', function () {
        Notification::fake();
        $author = memberWithRole($this->project, WorkspaceRole::Admin);
        $update = ProjectUpdate::factory()->for($this->project, 'workspace')->create(['author_id' => $author->id]);

        $this->actingAs($this->direksi)->post('/w/PLQ/arahan', ['body' => 'Prioritaskan landing page.', 'project_update_id' => $update->id])
            ->assertRedirect()->assertSessionHasNoErrors();

        $direction = ProjectDirection::query()->sole();
        expect($direction->project_update_id)->toBe($update->id)->and($direction->author_id)->toBe($this->direksi->id);

        Notification::assertSentTo([$this->pic, $author], ProjectDirectionNotification::class);
        Notification::assertNotSentTo($this->direksi, ProjectDirectionNotification::class);
        expect(Activity::query()->where('event', 'project.direction_given')->exists())->toBeTrue();
    });

    it('rejects a direction on an update of another project', function () {
        $other = makeProject($this->owner);
        $update = ProjectUpdate::factory()->for($other, 'workspace')->create();

        $this->actingAs($this->direksi)->post('/w/PLQ/arahan', ['body' => 'x', 'project_update_id' => $update->id])
            ->assertSessionHasErrors('project_update_id');
    });

    it('does not let the PIC steer', function () {
        $this->actingAs($this->pic)->post('/w/PLQ/minta-update')->assertForbidden();
        $this->actingAs($this->pic)->post('/w/PLQ/arahan', ['body' => 'x'])->assertForbidden();
    });

    it('marks a decision done, audits it and informs the author', function () {
        Notification::fake();
        $update = ProjectUpdate::factory()->for($this->project, 'workspace')->withDecision()->create(['author_id' => $this->pic->id]);

        $this->actingAs($this->pic)->post("/w/PLQ/update-proyek/{$update->id}/keputusan")->assertForbidden();
        $this->actingAs($this->direksi)->post("/w/PLQ/update-proyek/{$update->id}/keputusan")->assertRedirect();

        $update->refresh();
        expect($update->hasOpenDecision())->toBeFalse()
            ->and($update->decision_resolved_by)->toBe($this->direksi->id)
            ->and(AuditLog::query()->where('action', 'project.decision_resolved')->exists())->toBeTrue();
        Notification::assertSentTo($this->pic, ProjectDecisionResolvedNotification::class);

        // Second time: already done.
        $this->actingAs($this->direksi)->post("/w/PLQ/update-proyek/{$update->id}/keputusan")->assertForbidden();
    });

    it('scopes decisions to the project in the URL', function () {
        $other = makeProject($this->owner);
        $update = ProjectUpdate::factory()->for($other, 'workspace')->withDecision()->create();

        $this->actingAs($this->direksi)->post("/w/PLQ/update-proyek/{$update->id}/keputusan")->assertNotFound();
    });
});

describe('milestones & risks', function () {
    it('creates, edits, completes and deletes milestones with linked tasks', function () {
        $task = Task::factory()->inStatus(statusOf($this->project, 'todo'))->create();
        $foreign = Task::factory()->create();

        $this->actingAs($this->pic)->post('/w/PLQ/milestone', [
            'name' => 'Siaran pers final', 'target_date' => '2026-10-01', 'task_ids' => [$task->id, $foreign->id],
        ])->assertRedirect()->assertSessionHasNoErrors();

        $milestone = Milestone::query()->sole();
        expect($milestone->tasks()->pluck('tasks.id')->all())->toBe([$task->id]);

        $this->actingAs($this->pic)->patch("/w/PLQ/milestone/{$milestone->id}", ['name' => 'Siaran pers', 'target_date' => '2026-10-08', 'task_ids' => []])->assertRedirect();
        expect($milestone->fresh()?->name)->toBe('Siaran pers')->and($milestone->tasks()->count())->toBe(0);

        $this->actingAs($this->pic)->patch("/w/PLQ/milestone/{$milestone->id}/selesai", ['completed' => true])->assertRedirect();
        expect($milestone->fresh()?->completed_at)->not->toBeNull();

        $this->actingAs($this->pic)->delete("/w/PLQ/milestone/{$milestone->id}")->assertRedirect();
        expect(Milestone::query()->count())->toBe(0)
            ->and(Activity::query()->where('event', 'like', 'milestone.%')->pluck('event')->all())
            ->toBe(['milestone.created', 'milestone.updated', 'milestone.completed', 'milestone.deleted']);
    });

    it('scopes milestones to their project', function () {
        $milestone = Milestone::factory()->for(makeProject($this->owner), 'workspace')->create();

        $this->actingAs($this->owner)->delete("/w/PLQ/milestone/{$milestone->id}")->assertNotFound();
    });

    it('creates, resolves and deletes risks', function () {
        $member = memberWithRole($this->project, WorkspaceRole::Member);
        $outsider = User::factory()->create();

        $this->actingAs($this->pic)->post('/w/PLQ/risiko', ['title' => 'Kutipan direksi belum diterima', 'level' => 'high', 'owner_id' => $outsider->id])
            ->assertSessionHasErrors('owner_id');
        $this->actingAs($this->pic)->post('/w/PLQ/risiko', ['title' => 'Kutipan direksi belum diterima', 'level' => 'high', 'owner_id' => $member->id])
            ->assertSessionHasNoErrors();

        $risk = ProjectRisk::query()->sole();
        $this->actingAs($this->pic)->patch("/w/PLQ/risiko/{$risk->id}", ['title' => $risk->title, 'level' => 'medium', 'status' => 'resolved'])->assertRedirect();
        expect($risk->fresh()?->resolved_at)->not->toBeNull()
            ->and(Activity::query()->where('event', 'risk.resolved')->exists())->toBeTrue();

        $this->actingAs($member)->delete("/w/PLQ/risiko/{$risk->id}")->assertForbidden();
        $this->actingAs($this->pic)->delete("/w/PLQ/risiko/{$risk->id}")->assertRedirect();
        expect(ProjectRisk::query()->count())->toBe(0);
    });
});

describe('project attributes', function () {
    it('lets workspace managers set PIC, sponsor, division, dates and status', function () {
        $division = Division::factory()->create();

        $this->actingAs($this->owner)->patch('/w/PLQ/proyek', [
            'lead_user_id' => $this->pic->id,
            'sponsor_user_id' => $this->direksi->id,
            'division_id' => $division->id,
            'start_date' => '2026-09-01',
            'target_date' => '2026-10-27',
            'project_status' => 'completed',
        ])->assertRedirect()->assertSessionHasNoErrors();

        $project = $this->project->fresh();
        expect($project->division_id)->toBe($division->id)
            ->and($project->completed_at)->not->toBeNull()
            ->and(AuditLog::query()->where('action', 'project.attributes_changed')->exists())->toBeTrue();
    });

    it('validates PIC membership, the Direksi sponsor and the date order', function () {
        $this->actingAs($this->owner)->patch('/w/PLQ/proyek', [
            'lead_user_id' => User::factory()->create()->id,
            'sponsor_user_id' => $this->pic->id,
            'start_date' => '2026-10-10',
            'target_date' => '2026-10-01',
            'project_status' => 'active',
        ])->assertSessionHasErrors(['lead_user_id', 'sponsor_user_id', 'target_date']);
    });

    it('is closed to the PIC without a manager role and to members', function () {
        $this->actingAs($this->pic)->patch('/w/PLQ/proyek', ['project_status' => 'on_hold'])->assertForbidden();
    });
});
