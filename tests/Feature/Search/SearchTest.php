<?php

use App\Domain\Organization\Enums\Role;
use App\Domain\Search\Contracts\SearchProvider;
use App\Domain\Search\Data\SearchResult;
use App\Domain\Search\Providers\ActionsSearchProvider;
use App\Domain\Search\Providers\PeopleSearchProvider;
use App\Models\Company;
use App\Models\Division;
use App\Models\Position;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Testing\TestResponse;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
});

function searcher(Role $role = Role::Anggota): User
{
    $user = User::factory()->create(['name' => 'Penguji Pencarian', 'email' => 'penguji@demo.test']);
    $user->assignRole($role->value);

    return $user;
}

/**
 * @return list<string>
 */
function groupKeys(TestResponse $response): array
{
    return collect($response->json('groups'))->pluck('key')->all();
}

/**
 * @return list<string>
 */
function itemTitles(TestResponse $response, string $group): array
{
    $items = collect($response->json('groups'))->firstWhere('key', $group)['items'] ?? [];

    return collect($items)->pluck('title')->all();
}

it('requires authentication', function () {
    $this->getJson('/cari/hasil?q=ani')->assertUnauthorized();
    $this->get('/cari')->assertRedirect(route('login'));
});

it('shows quick actions on an empty query', function () {
    $response = $this->actingAs(searcher())->getJson('/cari/hasil')->assertOk();

    expect(groupKeys($response))->toBe(['actions'])
        ->and(itemTitles($response, 'actions'))->toBe(['Check-in', 'Ajukan cuti', 'Buat tugas baru', 'Ganti tema']);
});

it('matches actions by title and keywords', function (string $query, string $expected) {
    $response = $this->actingAs(searcher())->getJson('/cari/hasil?q='.urlencode($query))->assertOk();

    expect(itemTitles($response, 'actions'))->toContain($expected);
})->with([
    ['cuti', 'Ajukan cuti'],
    ['gelap', 'Ganti tema'],
    ['notif', 'Pengaturan notifikasi'],
    ['PERSETUJUAN', 'Persetujuan'],
]);

it('hides admin actions from roles that may not use them', function (Role $role, bool $seesEmployees, bool $seesDivision) {
    $viewer = searcher($role);
    $karyawan = itemTitles($this->actingAs($viewer)->getJson('/cari/hasil?q=karyawan')->assertOk(), 'actions');
    $anggota = itemTitles($this->actingAs($viewer)->getJson('/cari/hasil?q=anggota divisi')->assertOk(), 'actions');

    expect(in_array('Karyawan', $karyawan, true))->toBe($seesEmployees)
        ->and(in_array('Anggota divisi', $anggota, true))->toBe($seesDivision);
})->with([
    'super admin' => [Role::SuperAdmin, true, false],
    'hr' => [Role::Hr, true, false],
    'kepala divisi' => [Role::KepalaDivisi, false, true],
    'direksi' => [Role::Direksi, false, false],
    'anggota' => [Role::Anggota, false, false],
]);

it('finds people by name or email with their placement (HR sees the whole company)', function () {
    $division = Division::factory()->create(['name' => 'Operasional']);
    $position = Position::factory()->create(['name' => 'Staf Operasional']);
    User::factory()->inDivision($division)->create(['name' => 'Sari Wulandari', 'email' => 'sari@demo.test', 'position_id' => $position->id]);
    User::factory()->create(['name' => 'Rizky Aditya', 'email' => 'rizky.wulan@demo.test']);
    User::factory()->create(['name' => 'Hana Pratiwi', 'email' => 'hana@demo.test']);

    $response = $this->actingAs(searcher(Role::Hr))->getJson('/cari/hasil?q=wulan')->assertOk();
    $people = collect($response->json('groups'))->firstWhere('key', 'people');

    expect(collect($people['items'])->pluck('title')->all())->toBe(['Rizky Aditya', 'Sari Wulandari'])
        ->and($people['label'])->toBe('Orang')
        ->and($people['items'][1])->toMatchArray([
            'subtitle' => 'Staf Operasional · Operasional',
            'meta' => 'sari@demo.test',
            'url' => 'mailto:sari@demo.test',
            'icon' => 'user',
        ])
        ->and($people['items'][0]['subtitle'])->toBe('rizky.wulan@demo.test')
        ->and(json_encode($people))->not->toContain('password');
});

it('limits people to User::visibleTo — members see themselves and direct reports only', function () {
    $viewer = User::factory()->withRole(Role::Anggota)->create(['name' => 'Budi Kartika']);
    User::factory()->managedBy($viewer)->create(['name' => 'Budi Bawahan']);
    User::factory()->create(['name' => 'Budi Lain Divisi']);

    $response = $this->actingAs($viewer)->getJson('/cari/hasil?q=budi')->assertOk();

    expect(itemTitles($response, 'people'))->toBe(['Budi Bawahan', 'Budi Kartika']);
});

it('lets a division head find the members of the division they lead', function () {
    $head = User::factory()->withRole(Role::KepalaDivisi)->create(['name' => 'Dimas Pratama']);
    $division = Division::factory()->headedBy($head)->create();
    User::factory()->inDivision($division)->create(['name' => 'Anggota Ops']);
    User::factory()->create(['name' => 'Anggota Keuangan']);

    $response = $this->actingAs($head)->getJson('/cari/hasil?q=anggota')->assertOk();

    expect(itemTitles($response, 'people'))->toBe(['Anggota Ops']);
});

it('never shows inactive employees or other companies', function () {
    User::factory()->inactive()->create(['name' => 'Teguh Santoso']);
    User::factory()->resigned()->create(['name' => 'Tiara Santoso']);
    User::factory()->forCompany(Company::factory()->create())->create(['name' => 'Tamu Santoso']);
    User::factory()->create(['name' => 'Aktif Santoso']);

    $response = $this->actingAs(searcher(Role::Hr))->getJson('/cari/hasil?q=santoso')->assertOk();

    expect(itemTitles($response, 'people'))->toBe(['Aktif Santoso']);
});

it('needs at least two characters for people', function () {
    User::factory()->create(['name' => 'Ani']);

    $response = $this->actingAs(searcher())->getJson('/cari/hasil?q=a')->assertOk();

    expect(groupKeys($response))->not->toContain('people');
});

it('treats LIKE wildcards literally', function () {
    User::factory()->create(['name' => 'Budi Santoso']);

    $response = $this->actingAs(searcher())->getJson('/cari/hasil?q='.urlencode('%_'))->assertOk();

    expect(groupKeys($response))->not->toContain('people');
});

it('limits one group when a filter chip is selected', function () {
    User::factory()->count(8)->create(['name' => 'Karyawan Contoh']);

    $viewer = searcher(Role::Hr);
    $all = $this->actingAs($viewer)->getJson('/cari/hasil?q=contoh')->assertOk();
    $people = $this->actingAs($viewer)->getJson('/cari/hasil?q=contoh&group=people')->assertOk();

    expect(collect($all->json('groups'))->firstWhere('key', 'people')['items'])->toHaveCount(5)
        ->and(groupKeys($people))->toBe(['people'])
        ->and($people->json('groups.0.items'))->toHaveCount(8);
});

it('validates the query and group', function () {
    $this->actingAs(searcher())
        ->getJson('/cari/hasil?q='.str_repeat('a', 101).'&group=tasks')
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['q', 'group']);
});

it('runs registered providers in config order and respects their own visibility', function () {
    config(['search.providers' => [ActionsSearchProvider::class, OwnOnlyFakeProvider::class, PeopleSearchProvider::class]]);
    $viewer = searcher();

    $response = $this->actingAs($viewer)->getJson('/cari/hasil?q=penguji')->assertOk();

    expect(groupKeys($response))->toBe(['tasks', 'people'])
        ->and($response->json('groups.0.items.0.title'))->toBe("Tugas milik {$viewer->name}");
});

it('renders the mobile search screen', function () {
    $this->actingAs(searcher())
        ->get('/cari?q=landing')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('search/index')
            ->where('q', 'landing')
            ->where('groups', [
                ['key' => 'actions', 'label' => 'Aksi'],
                ['key' => 'people', 'label' => 'Orang'],
            ]));
});

/**
 * Stand-in for a module provider (e.g. tasks): returns only the viewer's own records.
 */
final class OwnOnlyFakeProvider implements SearchProvider
{
    public function key(): string
    {
        return 'tasks';
    }

    public function label(): string
    {
        return 'Tugas';
    }

    public function minQueryLength(): int
    {
        return 2;
    }

    public function search(User $viewer, string $query, int $limit): array
    {
        return [new SearchResult(id: 'task:1', title: "Tugas milik {$viewer->name}", icon: 'circle', url: '/tugas')];
    }
}
