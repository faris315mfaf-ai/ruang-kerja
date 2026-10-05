<?php

use App\Domain\Documentation\Data\DocumentEntry;
use App\Domain\Documentation\Services\DocumentCatalog;
use App\Domain\Documentation\Services\DocumentRenderer;
use App\Domain\Organization\Enums\Role;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\File;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->admin = User::factory()->withRole(Role::SuperAdmin)->create();
});

/**
 * A throw-away repository root with a few docs and a secret next to it.
 */
function fakeDocsRoot(): string
{
    $base = sys_get_temp_dir().'/rk-docs-'.bin2hex(random_bytes(6));
    $root = $base.'/repo';
    File::ensureDirectoryExists($root.'/docs/sprints/sprint-2');
    File::ensureDirectoryExists($root.'/docs/sprints/sprint-10');
    File::put($root.'/README.md', "# Repo\n\nLihat [PRD](docs/PRD.md#tujuan) dan [kode](app/Models/User.php).\n");
    File::put($root.'/docs/PRD.md', "# PRD\n\n## Tujuan\n\nKembali ke [README](../README.md).\n");
    File::put($root.'/docs/sprints/sprint-2/SUMMARY.md', "# Sprint 2 — Absensi\n");
    File::put($root.'/docs/sprints/sprint-2/PLAN.md', "# Rencana\n");
    File::put($root.'/docs/sprints/sprint-10/SUMMARY.md', "# Sprint 10 — Ops\n");
    File::put($root.'/.env', "APP_KEY=secret\n");
    File::put($root.'/composer.json', '{}');
    File::put($base.'/outside.md', "# Rahasia di luar repo\n");
    symlink($base.'/outside.md', $root.'/docs/link-keluar.md');

    test()->tempDocsBase = $base;
    app()->instance(DocumentCatalog::class, new DocumentCatalog($root));

    return $root;
}

afterEach(function () {
    if (isset($this->tempDocsBase)) {
        File::deleteDirectory($this->tempDocsBase);
    }
});

test('only an active Super Admin can open the documentation', function (Role $role, bool $allowed) {
    $user = $role === Role::SuperAdmin ? $this->admin : User::factory()->withRole($role)->create();

    $index = $this->actingAs($user)->get(route('admin.docs.index'));
    $show = $this->actingAs($user)->get(route('admin.docs.show', 'readme'));

    if ($allowed) {
        $index->assertOk();
        $show->assertOk();
    } else {
        $index->assertForbidden();
        $show->assertForbidden();
    }
})->with([
    [Role::SuperAdmin, true],
    [Role::Direksi, false],
    [Role::Hr, false],
    [Role::KepalaDivisi, false],
    [Role::Anggota, false],
]);

test('guests are sent to the login page', function () {
    $this->get(route('admin.docs.index'))->assertRedirect(route('login'));
    $this->get(route('admin.docs.show', 'readme'))->assertRedirect(route('login'));
});

test('the index lists the curated documents grouped, without content', function () {
    $this->actingAs($this->admin)
        ->get(route('admin.docs.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/docs/index')
            ->where('document', null)
            ->where('groups.0', ['key' => 'start', 'label' => 'Mulai di sini'])
            ->where('documents', function ($documents): bool {
                $slugs = collect($documents)->pluck('slug');

                return $slugs->take(5)->all() === ['readme', 'handoff', 'critical', 'changelog', 'setup-lokal']
                    && $slugs->contains('asvs-l1')
                    && $slugs->contains('sprints-sprint-0-summary')
                    && $slugs->contains('sprints-sprint-1-core-summary')
                    && $slugs->contains('sprints-fitur-dokumentasi')
                    && ! $slugs->contains(fn (string $slug): bool => str_contains($slug, 'plan'))
                    && collect($documents)->every(fn (array $doc): bool => ! array_key_exists('html', $doc));
            }));
});

test('every curated document renders', function () {
    $slugs = app(DocumentCatalog::class)->all()->keys();

    expect($slugs)->toContain('readme', 'handoff', 'critical', 'changelog', 'prd', 'database', 'asvs-l1');

    foreach ($slugs as $slug) {
        $this->actingAs($this->admin)
            ->get(route('admin.docs.show', $slug))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('document.slug', $slug)
                ->where('document.html', fn (string $html): bool => $html !== '')
                ->has('document.toc'));
    }
});

test('a document page has its HTML and a table of contents', function () {
    $this->actingAs($this->admin)
        ->get(route('admin.docs.show', 'handoff'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/docs/index')
            ->where('document.path', 'docs/HANDOFF.md')
            ->where('document.title', 'Serah terima')
            ->where('document.html', fn (string $html): bool => str_contains($html, '<h2 id="doc-'))
            ->where('document.toc.0.level', 2)
            ->where('document.toc.0.id', fn (string $id): bool => str_starts_with($id, 'doc-'))
            ->has('documents'));
});

test('unknown slugs are 404', function (string $slug) {
    $this->actingAs($this->admin)->get('/admin/dokumentasi/'.$slug)->assertNotFound();
})->with([
    'unknown' => 'tidak-ada',
    'file name' => 'README.md',
    'upper case' => 'README',
    'plan not allowlisted' => 'sprints-sprint-2-plan',
]);

test('path traversal in the URL never reaches the filesystem', function (string $uri) {
    $this->actingAs($this->admin)->get($uri)->assertNotFound();
})->with([
    '/admin/dokumentasi/..%2F.env',
    '/admin/dokumentasi/%2e%2e%2f%2e%2e%2fetc%2fpasswd',
    '/admin/dokumentasi/..%5C.env',
    '/admin/dokumentasi/docs%2FPRD.md',
    '/admin/dokumentasi/readme%00',
    '/admin/dokumentasi/readme/../../.env',
]);

test('the catalog skips config entries outside the allowlist rules', function () {
    $root = fakeDocsRoot();
    config()->set('docs.documents', [
        'readme' => ['path' => 'README.md', 'title' => 'README', 'group' => 'start'],
        'prd' => ['path' => 'docs/PRD.md', 'title' => 'PRD', 'group' => 'product'],
        'parent' => ['path' => '../outside.md', 'title' => 'x', 'group' => 'start'],
        'dotdot' => ['path' => 'docs/../../outside.md', 'title' => 'x', 'group' => 'start'],
        'absolute' => ['path' => $root.'/README.md', 'title' => 'x', 'group' => 'start'],
        'env' => ['path' => '.env', 'title' => 'x', 'group' => 'start'],
        'json' => ['path' => 'composer.json', 'title' => 'x', 'group' => 'start'],
        'symlink' => ['path' => 'docs/link-keluar.md', 'title' => 'x', 'group' => 'start'],
        'missing' => ['path' => 'docs/TIDAK-ADA.md', 'title' => 'x', 'group' => 'start'],
        'scheme' => ['path' => 'phar://docs/PRD.md', 'title' => 'x', 'group' => 'start'],
        'Bad Slug' => ['path' => 'docs/PRD.md', 'title' => 'x', 'group' => 'start'],
    ]);
    config()->set('docs.patterns', [
        ['glob' => 'docs/sprints/*/SUMMARY*.md', 'group' => 'sprints'],
        ['glob' => '../*.md', 'group' => 'sprints'],
    ]);

    $catalog = app(DocumentCatalog::class);

    expect($catalog->all()->keys()->all())->toBe(['readme', 'prd', 'sprints-sprint-2-summary', 'sprints-sprint-10-summary'])
        ->and($catalog->find('sprints-sprint-2-summary')?->title)->toBe('Sprint 2 — Absensi')
        ->and($catalog->find('../outside'))->toBeNull()
        ->and($catalog->find('symlink'))->toBeNull();

    $this->actingAs($this->admin)->get(route('admin.docs.show', 'symlink'))->assertNotFound();
    $this->actingAs($this->admin)->get(route('admin.docs.show', 'env'))->assertNotFound();
});

test('rendering escapes raw HTML and neutralises unsafe links', function () {
    $entry = app(DocumentCatalog::class)->find('readme');
    expect($entry)->toBeInstanceOf(DocumentEntry::class);

    $html = app(DocumentRenderer::class)->convert($entry, <<<'MD'
        # Judul

        <script>alert('xss')</script>

        <img src=x onerror="alert(1)">

        Teks <b onclick="x()">tebal</b> dan <!-- komentar rahasia --> akhir.

        [klik](javascript:alert(1)) · [data](data:text/html;base64,PHNjcmlwdD4=) · [vb](vbscript:msgbox)

        ![gambar](https://tracker.example/pixel.png)

        [luar](https://laravel.com)
        MD)->html;

    expect($html)
        ->not->toContain('<script')
        ->not->toContain('<img')
        ->not->toContain('<b ')
        ->not->toContain('javascript:')
        ->not->toContain('vbscript:')
        ->not->toContain('data:text/html')
        ->not->toContain('komentar rahasia')
        ->not->toContain('tracker.example')
        ->toContain('&lt;script&gt;alert(\'xss\')&lt;/script&gt;')
        ->toContain('gambar')
        ->toContain('<a>klik</a>')
        ->toMatch('#<a target="_blank" rel="noopener noreferrer" href="https://laravel.com">luar</a>#');
});

test('links between allowlisted docs become in-app links; other relative links become text', function () {
    fakeDocsRoot();
    config()->set('docs.documents', [
        'readme' => ['path' => 'README.md', 'title' => 'README', 'group' => 'start'],
        'prd' => ['path' => 'docs/PRD.md', 'title' => 'PRD', 'group' => 'product'],
    ]);
    config()->set('docs.patterns', []);

    $catalog = app(DocumentCatalog::class);
    $renderer = new DocumentRenderer($catalog);

    $readme = $renderer->render($catalog->find('readme') ?? throw new RuntimeException);
    $prd = $renderer->render($catalog->find('prd') ?? throw new RuntimeException);

    expect($readme->html)
        ->toContain('<a href="/admin/dokumentasi/prd#doc-tujuan">PRD</a>')
        ->toContain('dan kode.')
        ->not->toContain('User.php')
        ->and($prd->html)->toContain('<a href="/admin/dokumentasi/readme">README</a>')
        ->and($prd->toc)->toBe([['id' => 'doc-tujuan', 'text' => 'Tujuan', 'level' => 2]]);
});

test('duplicate headings get unique ids', function () {
    $entry = app(DocumentCatalog::class)->find('readme') ?? throw new RuntimeException;

    $toc = app(DocumentRenderer::class)->convert($entry, "# T\n\n## Catatan\n\n### Detail\n\n## Catatan\n\n#### Dalam\n")->toc;

    expect($toc)->toBe([
        ['id' => 'doc-catatan', 'text' => 'Catatan', 'level' => 2],
        ['id' => 'doc-detail', 'text' => 'Detail', 'level' => 3],
        ['id' => 'doc-catatan-1', 'text' => 'Catatan', 'level' => 2],
    ]);
});
