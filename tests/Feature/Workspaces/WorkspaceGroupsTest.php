<?php

use App\Domain\Organization\Enums\Role;
use App\Domain\Workspaces\Enums\WorkspaceGroup;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Models\Division;
use App\Models\User;
use App\Models\Workspace;
use Database\Seeders\RoleSeeder;
use Inertia\Testing\AssertableInertia as Assert;

require_once __DIR__.'/../../Support/workspace-helpers.php';

/*
 * Workspace list groups (keputusan pemilik 6 Okt 2026): Pribadi · Divisi &
 * tim · Proyek yang diikuti · Lainnya (lihat saja), chip filter `?jenis=`.
 */
beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->head = User::factory()->withRole(Role::KepalaDivisi)->create();
    $this->division = Division::factory()->headedBy($this->head)->create(['code' => 'OPS']);
    $this->staff = User::factory()->withRole(Role::Anggota)->inDivision($this->division)->create();

    // Creating the division made its workspace (key = division code).
    $this->divisionWs = Workspace::query()->where('type', 'division')->where('division_id', $this->division->id)->sole();
    addMember($this->divisionWs, $this->staff, WorkspaceRole::Member, synced: true);
    $this->team = Workspace::factory()->team()->ownedBy($this->head)->create(['key' => 'GDG']);
    addMember($this->team, $this->staff);
    $this->project = Workspace::factory()->project()->ownedBy($this->head)->create(['key' => 'PLQ']);
    addMember($this->project, $this->staff);
    $this->otherProject = Workspace::factory()->project()->ownedBy($this->head)->create(['key' => 'LAIN']);
});

/**
 * @return array<string, string> key => group
 */
function groupsOf(array $workspaces): array
{
    return collect($workspaces)->mapWithKeys(fn (array $w): array => [$w['key'] => $w['group']])->all();
}

it('groups the list of a member and keeps the chip in the query string', function () {
    $this->actingAs($this->staff)->get('/workspace?jenis=proyek')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('workspaces/index')
            ->where('filter', 'proyek')
            ->where('workspaces', function ($workspaces) {
                $groups = groupsOf(collect($workspaces)->all());

                return ($groups['OPS'] ?? null) === 'divisi'
                    && ($groups['GDG'] ?? null) === 'divisi'
                    && ($groups['PLQ'] ?? null) === 'proyek'
                    && ! array_key_exists('LAIN', $groups)
                    && in_array('pribadi', $groups, true)
                    && ! in_array('lainnya', $groups, true);
            }));

    $this->actingAs($this->staff)->get('/workspace?jenis=salah')
        ->assertInertia(fn (Assert $page) => $page->where('filter', null));
});

it('puts workspaces seen without membership under Lainnya (Direksi)', function () {
    $direksi = User::factory()->withRole(Role::Direksi)->create();

    $this->actingAs($direksi)->get('/workspace')
        ->assertInertia(fn (Assert $page) => $page
            ->where('filter', null)
            ->where('workspaces', function ($workspaces) {
                $groups = groupsOf(collect($workspaces)->all());

                return ($groups['PLQ'] ?? null) === 'lainnya'
                    && ($groups['OPS'] ?? null) === 'lainnya'
                    && ($groups['LAIN'] ?? null) === 'lainnya'
                    && in_array('pribadi', $groups, true);
            }));
});

it('sends the group with the sidebar workspaces (Dock stack, mobile Menu)', function () {
    $this->actingAs($this->staff)->get('/workspace')
        ->assertInertia(fn (Assert $page) => $page
            ->where('workspaces', fn ($workspaces) => collect($workspaces)->every(fn (array $w): bool => isset($w['group'])))
            ->has('workspaces'));

    $this->actingAs($this->staff)->get('/menu')
        ->assertInertia(fn (Assert $page) => $page->where('workspaces', function ($workspaces) {
            $groups = groupsOf(collect($workspaces)->all());

            return ($groups['PLQ'] ?? null) === 'proyek' && ($groups['OPS'] ?? null) === 'divisi' && in_array('pribadi', $groups, true);
        }));
});

it('maps types and membership to a group', function (WorkspaceType $type, bool $member, WorkspaceGroup $group) {
    expect(WorkspaceGroup::of($type, $member))->toBe($group);
})->with([
    [WorkspaceType::Personal, true, WorkspaceGroup::Personal],
    [WorkspaceType::Division, true, WorkspaceGroup::DivisionTeam],
    [WorkspaceType::Team, true, WorkspaceGroup::DivisionTeam],
    [WorkspaceType::Project, true, WorkspaceGroup::Project],
    [WorkspaceType::Project, false, WorkspaceGroup::Other],
    [WorkspaceType::Division, false, WorkspaceGroup::Other],
]);
