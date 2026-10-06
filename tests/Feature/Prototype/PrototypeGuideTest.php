<?php

use App\Domain\Documentation\Data\DocumentEntry;
use App\Domain\Documentation\Services\DocumentCatalog;
use App\Domain\Documentation\Services\DocumentRenderer;
use App\Domain\Documentation\Services\PrototypeGuideLinks;
use App\Domain\Organization\Enums\Role;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    config(['features.prototype' => true]);
});

function guideUser(Role $role = Role::Anggota): User
{
    $user = User::factory()->create();
    $user->assignRole($role->value);

    return $user;
}

test('every employee who can open the previews can read the guide', function (Role $role) {
    $this->actingAs(guideUser($role))
        ->get(route('prototype.guide'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('prototype/guide')
            ->where('guideSlug', 'panduan-pratinjau')
            ->where('document.slug', 'panduan-pratinjau')
            ->where('document.path', 'docs/fitur/PANDUAN-PRATINJAU.md')
            ->where('document.html', fn (string $html): bool => str_contains($html, '<h2 id="doc-')
                && str_contains($html, ' src="/pratinjau/panduan/gambar/'))
            ->has('document.toc.0')
            ->where('documents.0.slug', 'panduan-pratinjau')
            ->where('documents', fn ($documents): bool => collect($documents)->every(
                fn (array $doc): bool => $doc['group'] === 'features' && ! array_key_exists('html', $doc),
            )));
})->with([Role::Anggota, Role::KepalaDivisi, Role::Hr, Role::Direksi, Role::SuperAdmin]);

test('module docs of docs/fitur open inside the guide with their screenshots', function () {
    $this->actingAs(guideUser())
        ->get(route('prototype.guide.show', 'fitur-okr'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('prototype/guide')
            ->where('document.path', 'docs/fitur/okr.md')
            ->where('document.html', fn (string $html): bool => str_contains($html, ' src="/pratinjau/panduan/gambar/okr/daftar-desktop.jpg"')
                && str_contains($html, 'loading="lazy"')
                && str_contains($html, 'href="/pratinjau/panduan/fitur"')
                && ! str_contains($html, '/admin/dokumentasi')));
});

test('only documents of the features group are part of the guide', function (string $slug) {
    $this->actingAs(guideUser())->get('/pratinjau/panduan/'.$slug)->assertNotFound();
})->with(['prd', 'database', 'handoff', 'tidak-ada', 'README', 'fitur-okr.md']);

test('the guide answers 404 while the prototype flag is off', function (string $uri) {
    config(['features.prototype' => false]);

    $this->actingAs(guideUser())->get($uri)->assertNotFound();
})->with([
    '/pratinjau/panduan',
    '/pratinjau/panduan/fitur-okr',
    '/pratinjau/panduan/gambar/okr/daftar-desktop.jpg',
]);

test('guests are sent to the login page', function (string $uri) {
    $this->get($uri)->assertRedirect(route('login'));
})->with([
    '/pratinjau/panduan',
    '/pratinjau/panduan/fitur-okr',
    '/pratinjau/panduan/gambar/okr/daftar-desktop.jpg',
]);

test('screenshots are served from docs/fitur/img', function () {
    $response = $this->actingAs(guideUser())->get(route('prototype.guide.image', ['folder' => 'okr', 'file' => 'daftar-desktop.jpg']));

    $response->assertOk()->assertHeader('Content-Type', 'image/jpeg');
    expect($response->baseResponse->getFile()->getRealPath())
        ->toBe(realpath(base_path('docs/fitur/img/okr/daftar-desktop.jpg')));
});

test('image paths outside docs/fitur/img never reach the filesystem', function (string $uri) {
    $this->actingAs(guideUser())->get($uri)->assertNotFound();
})->with([
    'missing file' => '/pratinjau/panduan/gambar/okr/tidak-ada.jpg',
    'other extension' => '/pratinjau/panduan/gambar/okr/daftar-desktop.php',
    'dot dot folder' => '/pratinjau/panduan/gambar/../okr/daftar-desktop.jpg',
    'encoded traversal' => '/pratinjau/panduan/gambar/%2e%2e/%2e%2e%2f.env',
    'encoded slash' => '/pratinjau/panduan/gambar/okr%2F..%2F..%2F..%2F.env/x.jpg',
    'backslash' => '/pratinjau/panduan/gambar/okr/..%5C..%5C.env.jpg',
    'nul byte' => '/pratinjau/panduan/gambar/okr/daftar-desktop.jpg%00.png',
    'upper case' => '/pratinjau/panduan/gambar/OKR/daftar-desktop.jpg',
    'nested' => '/pratinjau/panduan/gambar/okr/sub/daftar-desktop.jpg',
    'env' => '/pratinjau/panduan/gambar/x/.env',
]);

test('the image resolver rejects names and symlinks that leave the folder', function () {
    expect(PrototypeGuideLinks::imagePath('okr', 'daftar-desktop.jpg'))->not->toBeNull()
        ->and(PrototypeGuideLinks::imagePath('..', 'daftar-desktop.jpg'))->toBeNull()
        ->and(PrototypeGuideLinks::imagePath('okr', '../../../.env'))->toBeNull()
        ->and(PrototypeGuideLinks::imagePath('okr', 'daftar-desktop.JPG'))->toBeNull()
        ->and(PrototypeGuideLinks::imagePath('okr', 'tidak-ada.jpg'))->toBeNull();

    $link = base_path('docs/fitur/img/okr/uji-symlink-'.bin2hex(random_bytes(4)).'.jpg');
    symlink(base_path('composer.json'), $link);

    try {
        expect(PrototypeGuideLinks::imagePath('okr', basename($link)))->toBeNull();
    } finally {
        unlink($link);
    }
});

test('the guide context serves only docs/fitur/img screenshots; other images and links become text', function () {
    $entry = app(DocumentCatalog::class)->find('panduan-pratinjau') ?? throw new RuntimeException;

    $html = app(DocumentRenderer::class)->convert($entry, <<<'MD'
        # Uji

        ![layar okr](img/okr/daftar-desktop.jpg)
        ![tidak ada](img/okr/tidak-ada.jpg)
        ![keluar](../../composer.json)
        ![luar](https://tracker.example/pixel.png)
        ![mockup](../mockups/png/desktop/Main.png)

        [modul](okr.md#tujuan) · [prd](../PRD.md) · [kode](../../routes/prototype.php)
        MD, new PrototypeGuideLinks)->html;

    expect($html)
        ->toContain('<img loading="lazy" decoding="async" src="/pratinjau/panduan/gambar/okr/daftar-desktop.jpg" alt="layar okr" />')
        ->toContain('tidak ada')
        ->not->toContain('tidak-ada.jpg')
        ->not->toContain('composer.json')
        ->not->toContain('tracker.example')
        ->not->toContain('Main.png')
        ->toContain('<a href="/pratinjau/panduan/fitur-okr#doc-tujuan">modul</a>')
        ->toContain('prd')
        ->not->toContain('/admin/dokumentasi')
        ->not->toContain('href="../');
});

test('Admin › Dokumentasi keeps replacing screenshots by their alt text', function () {
    $admin = guideUser(Role::SuperAdmin);

    $this->actingAs($admin)
        ->get(route('admin.docs.show', 'panduan-pratinjau'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('document.html', fn (string $html): bool => ! str_contains($html, '<img')));

    $entry = app(DocumentCatalog::class)->find('fitur-okr');
    expect($entry)->toBeInstanceOf(DocumentEntry::class)
        ->and(app(DocumentRenderer::class)->render($entry)->html)
        ->toContain('/admin/dokumentasi/fitur')
        ->not->toContain('<img');
});
