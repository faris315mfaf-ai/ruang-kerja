<?php

use App\Domain\Organization\Enums\Role;
use App\Domain\Search\Providers\TaskSearchProvider;
use App\Domain\Search\Providers\WorkspaceSearchProvider;
use App\Domain\Tasks\Actions\CreateTask;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\DB;

require_once __DIR__.'/../../Support/workspace-helpers.php';

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->owner = User::factory()->withRole(Role::KepalaDivisi)->create();
    $this->project = Workspace::factory()->ownedBy($this->owner)->create(['key' => 'PLQ', 'name' => 'Proyek Peluncuran Q4']);
    $this->member = memberWithRole($this->project, WorkspaceRole::Member);
    app(CreateTask::class)->handle($this->project, $this->owner, ['title' => 'Landing page produk baru']);
});

it('finds tasks by title and by KEY-n, only in visible workspaces', function () {
    $provider = app(TaskSearchProvider::class);
    $personal = Workspace::query()->where('type', 'personal')->where('owner_id', $this->owner->id)->firstOrFail();
    app(CreateTask::class)->handle($personal, $this->owner, ['title' => 'Landing pribadi rahasia']);

    expect(collect($provider->search($this->member, 'landing', 10))->pluck('code')->all())->toBe(['PLQ-1'])
        ->and(collect($provider->search($this->member, 'plq-1', 10))->pluck('title')->all())->toBe(['Landing page produk baru'])
        ->and($provider->search(User::factory()->withRole(Role::SuperAdmin)->create(), 'rahasia', 10))->toBe([])
        ->and(collect($provider->search($this->owner, 'rahasia', 10))->pluck('subtitle')->all())->toBe(['Pribadi'])
        ->and($provider->search(User::factory()->create(), 'landing', 10))->toBe([]);
});

it('finds workspaces by name or key for those who may see them', function () {
    $provider = app(WorkspaceSearchProvider::class);

    expect(collect($provider->search($this->member, 'peluncuran', 10))->pluck('url')->all())->toBe(['/w/PLQ'])
        ->and(collect($provider->search($this->member, 'plq', 10))->pluck('code')->all())->toBe(['PLQ'])
        ->and($provider->search(User::factory()->create(), 'peluncuran', 10))->toBe([])
        ->and(collect($provider->search(User::factory()->withRole(Role::Direksi)->create(), 'peluncuran', 10))->pluck('code')->all())->toBe(['PLQ']);
});

it('is wired into the search endpoint', function () {
    $this->actingAs($this->member)
        ->getJson('/cari/hasil?q=landing')
        ->assertOk()
        ->assertJsonPath('groups.0.key', 'tasks');
});

it('searches tasks through the full-text index with prefixes, web syntax, rank and a description excerpt', function () {
    $provider = app(TaskSearchProvider::class);
    app(CreateTask::class)->handle($this->project, $this->owner, [
        'title' => 'Rapat vendor',
        'description_text' => 'Siapkan bahan presentasi. Sebelum rapat, kirim laporan stok gudang ke tim keuangan agar angka cocok dengan catatan pembelian.',
    ]);
    app(CreateTask::class)->handle($this->project, $this->owner, ['title' => 'Laporan stok bulanan']);

    DB::enableQueryLog();
    $results = collect($provider->search($this->member, 'laporan stok', 10));
    $sql = collect(DB::getQueryLog())->pluck('query')->implode("\n");

    // Title (weight A) ranks above description (weight B); the description hit carries an excerpt.
    expect($results->pluck('title')->all())->toBe(['Laporan stok bulanan', 'Rapat vendor'])
        ->and($results[0]->snippet)->toBeNull()
        ->and($results[1]->snippet)->toContain('laporan stok gudang')
        ->and(mb_strlen((string) $results[1]->snippet))->toBeLessThan(160)
        ->and($sql)->toContain('search_vector @@')
        ->and($sql)->toContain('websearch_to_tsquery')
        ->and($sql)->not->toContain('ilike');

    expect(collect($provider->search($this->member, 'lapor', 10))->pluck('title')->all())->toContain('Laporan stok bulanan')
        ->and(collect($provider->search($this->member, 'stok -bulanan', 10))->pluck('title')->all())->toBe(['Rapat vendor'])
        ->and(collect($provider->search($this->member, '"page produk"', 10))->pluck('code')->all())->toBe(['PLQ-1'])
        ->and($provider->search($this->member, '&|!:*()', 10))->toBe([]);
});

it('builds a safe prefix query', function () {
    expect(TaskSearchProvider::prefixQuery('Lapor  ming!'))->toBe('lapor:* & ming:*')
        ->and(TaskSearchProvider::prefixQuery("&|!:*()'"))->toBeNull()
        ->and(TaskSearchProvider::prefixQuery('stok -bulanan'))->toBeNull()
        ->and(TaskSearchProvider::prefixQuery('"page produk"'))->toBeNull();
});
