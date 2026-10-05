<?php

use App\Domain\Organization\Data\OrgPerson;
use App\Domain\Organization\Enums\Role;
use App\Domain\Organization\Services\OrganizationTree;
use App\Models\Company;
use App\Models\Division;
use App\Models\Position;
use App\Models\Team;
use App\Models\User;
use Database\Seeders\OrganizationSeeder;
use Database\Seeders\RoleSeeder;

/**
 * @param  list<OrgPerson>  $people
 * @return list<string>
 */
function names(array $people): array
{
    return array_map(fn (OrgPerson $person): string => $person->name, $people);
}

it('builds Direksi → Divisi → Tim → anggota from the demo organization', function () {
    $this->seed(OrganizationSeeder::class);
    $viewer = User::query()->where('email', 'anggota@demo.test')->sole();

    $chart = app(OrganizationTree::class)->for($viewer);

    expect($chart->companyName)->toBe($viewer->company->name)
        ->and($chart->stats)->toBe(['divisions' => 4, 'teams' => 2, 'people' => 20])
        ->and($chart->board?->code)->toBe('DIR')
        ->and($chart->board?->head?->name)->toBe('Hendra Wijaya')
        ->and(names($chart->board->members ?? []))->toBe(['Lestari Anggraini'])
        ->and(array_map(fn ($division) => $division->code, $chart->divisions))->toBe(['KEU', 'OPS', 'PMS', 'SDM']);

    $ops = collect($chart->divisions)->firstWhere('code', 'OPS');
    expect($ops->head?->name)->toBe('Dimas Pratama')
        ->and($ops->size)->toBe(6)
        ->and($ops->teams)->toHaveCount(1)
        ->and($ops->teams[0]->name)->toBe('Tim Gudang')
        ->and($ops->teams[0]->code)->toBe('GDG')
        ->and($ops->teams[0]->lead?->name)->toBe('Sari Wulandari')
        ->and($ops->teams[0]->size)->toBe(3)
        ->and(names($ops->teams[0]->members))->toBe(['Nadia Putri', 'Yoga Pratama'])
        // Loose members: head excluded, staff without team only.
        ->and(names($ops->members))->toBe(['Bayu Saputra', 'Rizky Aditya']);

    $sdm = collect($chart->divisions)->firstWhere('code', 'SDM');
    // Resigned Tiara Anjani is not on the chart; Hana carries both roles.
    expect(names($sdm->members))->not->toContain('Tiara Anjani')
        ->and($sdm->size)->toBe(5)
        ->and($sdm->head?->roles)->toContain('hr')
        ->and($sdm->teams)->toBe([]);

    $pms = collect($chart->divisions)->firstWhere('code', 'PMS');
    // Inactive Teguh Santoso is hidden.
    expect(names($pms->members))->toBe([])
        ->and($pms->teams[0]->lead?->name)->toBe('Maya Lestari')
        ->and(names($pms->teams[0]->members))->toBe(['Rendi Oktavian']);

    // Admin Sistem has no division and leads nothing.
    expect(names($chart->unassigned))->toBe(['Admin Sistem']);
});

it('exposes directory fields only', function () {
    $this->seed(OrganizationSeeder::class);
    $viewer = User::query()->where('email', 'anggota@demo.test')->sole();

    $json = json_encode(app(OrganizationTree::class)->for($viewer));

    expect($json)->not->toContain('@demo.test')
        ->and($json)->not->toContain('"status"')
        ->and($json)->not->toContain('nik');
});

it('nests sub-divisions under their parent and treats board children as top level', function () {
    $this->seed(RoleSeeder::class);
    $board = Division::factory()->board()->create();
    $ops = Division::factory()->childOf($board)->create(['name' => 'Operasional', 'code' => 'OPS']);
    $gudang = Division::factory()->childOf($ops)->create(['name' => 'Gudang', 'code' => 'GDG']);
    Division::factory()->childOf($gudang)->create(['name' => 'Gudang Timur', 'code' => 'GDT']);
    Division::factory()->create(['name' => 'Keuangan', 'code' => 'KEU']);
    $viewer = User::factory()->create();

    $chart = app(OrganizationTree::class)->for($viewer);

    expect(array_map(fn ($division) => $division->code, $chart->divisions))->toBe(['KEU', 'OPS'])
        ->and($chart->divisions[1]->children)->toHaveCount(1)
        ->and($chart->divisions[1]->children[0]->code)->toBe('GDG')
        ->and($chart->divisions[1]->children[0]->children[0]->code)->toBe('GDT')
        ->and($chart->stats['divisions'])->toBe(4);
});

it('survives a corrupted parent cycle', function () {
    $a = Division::factory()->create(['code' => 'AAA']);
    $b = Division::factory()->childOf($a)->create(['code' => 'BBB']);
    $a->forceFill(['parent_id' => $b->id])->saveQuietly();

    $chart = app(OrganizationTree::class)->for(User::factory()->create());

    // Neither is a root, so the chart is empty rather than looping forever.
    expect($chart->divisions)->toBe([])
        ->and($chart->stats['divisions'])->toBe(2);
});

it('works without a board unit and ignores deleted units', function () {
    $division = Division::factory()->create(['code' => 'KEU']);
    $deleted = Division::factory()->create(['code' => 'OLD']);
    $deletedTeam = Team::factory()->for($division)->create();
    $deletedTeam->delete();
    $deleted->delete();

    $chart = app(OrganizationTree::class)->for(User::factory()->create());

    expect($chart->board)->toBeNull()
        ->and($chart->divisions)->toHaveCount(1)
        ->and($chart->divisions[0]->teams)->toBe([])
        ->and($chart->stats)->toBe(['divisions' => 1, 'teams' => 0, 'people' => 1]);
});

it('only shows the viewer\'s company', function () {
    $viewer = User::factory()->create();
    $other = Company::factory()->create();
    Division::factory()->forCompany($other)->create(['code' => 'XXX']);
    User::factory()->forCompany($other)->count(3)->create();
    Division::factory()->create(['code' => 'KEU']);

    $chart = app(OrganizationTree::class)->for($viewer);

    expect(array_map(fn ($division) => $division->code, $chart->divisions))->toBe(['KEU'])
        ->and($chart->stats['people'])->toBe(1);
});

it('orders members by position level, then name', function () {
    $division = Division::factory()->create();
    $staff = Position::factory()->level(5)->create();
    $senior = Position::factory()->level(4)->create();
    User::factory()->inDivision($division)->create(['name' => 'Budi', 'position_id' => $staff->id]);
    User::factory()->inDivision($division)->create(['name' => 'Ani', 'position_id' => $staff->id]);
    User::factory()->inDivision($division)->create(['name' => 'Citra', 'position_id' => $senior->id]);
    User::factory()->inDivision($division)->create(['name' => 'Dodi']);

    $chart = app(OrganizationTree::class)->for(User::factory()->create());

    expect(names($chart->divisions[0]->members))->toBe(['Citra', 'Ani', 'Budi', 'Dodi']);
});

it('places a team lead from outside the team on the team card only', function () {
    $this->seed(RoleSeeder::class);
    $division = Division::factory()->create();
    $lead = User::factory()->inDivision($division)->create(['name' => 'Ketua']);
    $team = Team::factory()->for($division)->ledBy($lead)->create();
    User::factory()->inDivision($division, $team)->create(['name' => 'Anggota Tim']);

    $chart = app(OrganizationTree::class)->for(User::factory()->withRole(Role::Anggota)->create());
    $node = $chart->divisions[0];

    expect($node->teams[0]->lead?->name)->toBe('Ketua')
        ->and(names($node->teams[0]->members))->toBe(['Anggota Tim'])
        ->and($node->teams[0]->size)->toBe(1)
        // The lead is not in the team (team_id null) so they stay listed in the division.
        ->and(names($node->members))->toBe(['Ketua'])
        ->and($node->size)->toBe(2);
});
