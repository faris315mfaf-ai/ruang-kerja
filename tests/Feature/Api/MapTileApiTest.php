<?php

use App\Domain\Organization\Enums\Role;
use App\Models\Company;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

/*
| API v1 — proxy ubin OpenStreetMap untuk peta Absen (B6): zoom 14–18,
| cache disk 7 hari (tanpa fetch ganda), kegagalan upstream = 204 + jeda.
*/

const TILE_PNG = "\x89PNG\r\n\x1a\n".'fake-tile-body';

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Storage::fake('local');
    Cache::flush();
    config(['services.osm.tile_url' => 'https://tile.test/{z}/{x}/{y}.png', 'services.osm.user_agent' => 'RuangKerja-Test/1.0']);

    $company = Company::factory()->create(['google_domain' => 'kantor.test']);
    $this->user = User::factory()->forCompany($company)->withRole(Role::Anggota)->create();
});

it('fetches a tile once with the descriptive User-Agent and then serves it from disk', function () {
    Http::fake(['tile.test/*' => Http::response(TILE_PNG, 200, ['Content-Type' => 'image/png'])]);
    Sanctum::actingAs($this->user);

    $first = $this->get('/api/v1/peta/17/104700/66300');
    $first->assertOk()->assertHeader('Content-Type', 'image/png');
    expect($first->headers->get('Cache-Control'))->toContain('max-age=604800')->toContain('private');
    expect($first->getContent())->toBe(TILE_PNG);

    $second = $this->get('/api/v1/peta/17/104700/66300');
    $second->assertOk();
    expect($second->getContent())->toBe(TILE_PNG);

    Http::assertSentCount(1);
    Http::assertSent(fn ($request) => $request->url() === 'https://tile.test/17/104700/66300.png'
        && $request->header('User-Agent')[0] === 'RuangKerja-Test/1.0');
    Storage::disk('local')->assertExists('osm-tiles/17/104700/66300.png');
});

it('refetches a tile older than the TTL', function () {
    Http::fake(['tile.test/*' => Http::response(TILE_PNG, 200)]);
    Sanctum::actingAs($this->user);
    Storage::disk('local')->put('osm-tiles/16/1/1.png', TILE_PNG);
    touch(Storage::disk('local')->path('osm-tiles/16/1/1.png'), time() - 8 * 86_400);

    $this->get('/api/v1/peta/16/1/1')->assertOk();

    Http::assertSentCount(1);
});

it('answers 204 without caching when upstream fails, and backs off briefly', function () {
    Http::fake(['tile.test/*' => Http::response('nope', 503)]);
    Sanctum::actingAs($this->user);

    $this->get('/api/v1/peta/17/10/10')->assertNoContent();
    $this->get('/api/v1/peta/17/10/10')->assertNoContent();

    Http::assertSentCount(1);
    Storage::disk('local')->assertMissing('osm-tiles/17/10/10.png');
});

it('does not accept non-PNG upstream bodies', function () {
    Http::fake(['tile.test/*' => Http::response('<html>blocked</html>', 200)]);
    Sanctum::actingAs($this->user);

    $this->get('/api/v1/peta/17/11/11')->assertNoContent();
    Storage::disk('local')->assertMissing('osm-tiles/17/11/11.png');
});

it('rejects zoom outside 14–18 and coordinates outside the zoom range', function (string $path) {
    Http::fake();
    Sanctum::actingAs($this->user);

    $this->getJson('/api/v1/peta/'.$path)->assertStatus(422)->assertJsonPath('code', 'invalid_tile');
    Http::assertNothingSent();
})->with([
    'zoom too low' => '13/1/1',
    'zoom too high' => '19/1/1',
    'x beyond range' => '14/16384/0',
    'y beyond range' => '14/0/16384',
]);

it('404s on non-numeric tile segments', function () {
    Sanctum::actingAs($this->user);

    $this->getJson('/api/v1/peta/17/abc/1')->assertNotFound();
    $this->getJson('/api/v1/peta/17/99999999999999999999/1')->assertNotFound();
});

it('requires a Sanctum token', function () {
    Http::fake();

    $this->getJson('/api/v1/peta/17/1/1')->assertUnauthorized();
    Http::assertNothingSent();
});

it('is not bound to the 60/min general API limiter', function () {
    Sanctum::actingAs($this->user);
    Storage::disk('local')->put('osm-tiles/17/5/5.png', TILE_PNG);

    foreach (range(1, 75) as $_) {
        $this->get('/api/v1/peta/17/5/5')->assertOk();
    }
});
