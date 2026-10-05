<?php

use App\Domain\Organization\Enums\Role;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Models\Division;
use App\Models\Milestone;
use App\Models\ProjectRisk;
use App\Models\ProjectUpdate;
use App\Models\User;
use App\Models\Workspace;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Gate;

require_once __DIR__.'/../../Support/project-helpers.php';

/*
 * PRD M10 "Akses": only the PIC and workspace admins write updates, milestones
 * and risks; Direksi steer; Direksi see every project, Kadiv only projects
 * involving their division.
 */

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->travelTo('2026-10-05 03:00:00');

    $this->owner = User::factory()->withRole(Role::KepalaDivisi)->create();
    $this->project = makeProject($this->owner);

    $this->actors = [
        'owner' => $this->owner,
        'pic' => memberWithRole($this->project, WorkspaceRole::Member),
        'pic_viewer' => null,
        'admin' => memberWithRole($this->project, WorkspaceRole::Admin),
        'member' => memberWithRole($this->project, WorkspaceRole::Member),
        'viewer' => memberWithRole($this->project, WorkspaceRole::Viewer),
        'outsider' => User::factory()->withRole(Role::Anggota)->create(),
        'super_admin' => User::factory()->withRole(Role::SuperAdmin)->create(),
        'direksi' => User::factory()->withRole(Role::Direksi)->create(),
        'hr' => User::factory()->withRole(Role::Hr)->create(),
        'kadiv' => User::factory()->withRole(Role::KepalaDivisi)->create(),
    ];
    unset($this->actors['pic_viewer']);

    $this->project->forceFill(['lead_user_id' => $this->actors['pic']->id])->save();
});

dataset('project abilities', [
    ['manageProject', ['owner', 'pic', 'admin', 'super_admin']],
    ['steerProject', ['super_admin', 'direksi']],
]);

it('applies the project role matrix', function (string $ability, array $allowed) {
    foreach ($this->actors as $name => $actor) {
        $response = Gate::forUser($actor)->inspect($ability, $this->project);

        expect($response->allowed())->toBe(in_array($name, $allowed, true), "{$name} → {$ability}");

        if (! $response->allowed()) {
            $visible = Gate::forUser($actor)->allows('view', $this->project);
            expect($response->status())->toBe($visible ? null : 404, "{$name} status");
        }
    }
})->with('project abilities');

it('lets only the PIC and workspace admins write updates, milestones and risks', function () {
    $milestone = Milestone::factory()->for($this->project, 'workspace')->create();
    $risk = ProjectRisk::factory()->for($this->project, 'workspace')->create();
    $writers = ['owner', 'pic', 'admin', 'super_admin'];

    foreach ($this->actors as $name => $actor) {
        $expected = in_array($name, $writers, true);
        $gate = Gate::forUser($actor);

        expect($gate->allows('create', [ProjectUpdate::class, $this->project]))->toBe($expected, "{$name} update")
            ->and($gate->allows('create', [Milestone::class, $this->project]))->toBe($expected, "{$name} milestone")
            ->and($gate->allows('update', $milestone))->toBe($expected, "{$name} edit milestone")
            ->and($gate->allows('delete', $risk))->toBe($expected, "{$name} delete risk");
    }
});

it('rejects updates over HTTP from members, viewers and Direksi', function () {
    $payload = ['health' => 'on_track', 'summary' => 'Berjalan baik.'];
    $key = $this->project->key;

    $this->actingAs($this->actors['member'])->post("/w/{$key}/update-proyek", $payload)->assertForbidden();
    $this->actingAs($this->actors['viewer'])->post("/w/{$key}/update-proyek", $payload)->assertForbidden();
    $this->actingAs($this->actors['direksi'])->post("/w/{$key}/update-proyek", $payload)->assertForbidden();
    $this->actingAs($this->actors['outsider'])->post("/w/{$key}/update-proyek", $payload)->assertNotFound();

    $this->actingAs($this->actors['pic'])->post("/w/{$key}/update-proyek", $payload)->assertRedirect();

    expect(ProjectUpdate::query()->count())->toBe(1);
});

it('treats the PIC as a writer even with a viewer role, but not after the PIC changes', function () {
    $viewer = $this->actors['viewer'];
    expect(Gate::forUser($viewer)->allows('manageProject', $this->project))->toBeFalse();

    $this->project->forceFill(['lead_user_id' => $viewer->id])->save();
    expect(Gate::forUser($viewer)->allows('manageProject', $this->project))->toBeTrue()
        ->and(Gate::forUser($this->actors['pic'])->allows('manageProject', $this->project))->toBeFalse();
});

it('makes archived projects and non-project workspaces read-only for tracking', function () {
    $team = Workspace::factory()->ownedBy($this->owner)->team()->create();
    expect(Gate::forUser($this->owner)->allows('manageProject', $team))->toBeFalse()
        ->and(Gate::forUser($this->actors['direksi'])->allows('steerProject', $team))->toBeFalse();

    $this->project->forceFill(['archived_at' => now()])->save();
    expect(Gate::forUser($this->actors['pic'])->allows('manageProject', $this->project))->toBeFalse()
        ->and(Gate::forUser($this->actors['direksi'])->allows('steerProject', $this->project))->toBeFalse();
});

describe('portfolio visibility', function () {
    beforeEach(function () {
        $this->ops = Division::factory()->create(['name' => 'Operasional']);
        $this->keu = Division::factory()->create(['name' => 'Keuangan']);
        $this->kadivOps = User::factory()->withRole(Role::KepalaDivisi)->inDivision($this->ops)->create();
        $this->ops->forceFill(['head_user_id' => $this->kadivOps->id])->save();
        $creator = User::factory()->withRole(Role::KepalaDivisi)->inDivision($this->keu)->create();

        // Member from OPS.
        $this->withOpsMember = makeProject($creator, ['name' => 'Anggota OPS']);
        addMember($this->withOpsMember, User::factory()->inDivision($this->ops)->create());
        // Primary division OPS, nobody from OPS.
        $this->primaryOps = makeProject($creator, ['name' => 'Divisi utama OPS', 'division_id' => $this->ops->id]);
        // Unrelated, even internal.
        $this->unrelated = makeProject($creator, ['name' => 'KEU saja', 'division_id' => $this->keu->id]);
        $this->internal = Workspace::factory()->ownedBy($creator)->project()->internal()->create(['name' => 'Internal KEU']);
    });

    it('shows Direksi every project', function () {
        $direksi = $this->actors['direksi'];
        $ids = Workspace::query()->portfolioFor($direksi)->pluck('id')->all();

        expect($ids)->toContain($this->withOpsMember->id, $this->primaryOps->id, $this->unrelated->id, $this->internal->id, $this->project->id);

        $this->actingAs($direksi)->get('/portofolio')->assertOk()
            ->assertInertia(fn ($page) => $page->component('projects/portfolio')->has('projects', 5));
    });

    it('shows a Kepala Divisi only projects involving their division', function () {
        $ids = Workspace::query()->portfolioFor($this->kadivOps)->pluck('id')->sort()->values()->all();

        expect($ids)->toBe(collect([$this->withOpsMember->id, $this->primaryOps->id])->sort()->values()->all());

        $this->actingAs($this->kadivOps)->get('/portofolio')->assertOk()
            ->assertInertia(fn ($page) => $page->has('projects', 2)->where('can.steer', false)->where('attendance', null));

        // Detail pages follow the same rule (internal projects stay readable for everyone).
        $this->actingAs($this->kadivOps)->get("/w/{$this->primaryOps->key}/ringkasan")->assertOk();
        $this->actingAs($this->kadivOps)->get("/w/{$this->unrelated->key}/ringkasan")->assertNotFound();
    });

    it('keeps the portfolio closed to regular employees', function () {
        $this->actingAs($this->actors['member'])->get('/portofolio')->assertForbidden();
        $this->actingAs($this->actors['hr'])->get('/portofolio')->assertForbidden();
    });

    it('limits members to their own projects in portfolioFor()', function () {
        $member = $this->actors['member'];

        expect(Workspace::query()->portfolioFor($member)->pluck('id')->all())->toBe([$this->project->id]);
    });
});
