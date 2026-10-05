<?php

use App\Domain\Analytics\Enums\DashboardView;
use App\Domain\Analytics\Services\DashboardAccess;
use Database\Seeders\RoleSeeder;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\AnalyticsFixtures as F;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    F::reset();
    $this->org = F::org();
});

it('grants dashboard views per role', function (string $who, array $views, string $default, bool $portfolio) {
    $user = $this->org[$who];
    $access = app(DashboardAccess::class);

    expect(array_map(fn (DashboardView $view): string => $view->value, $access->views($user)))->toBe($views)
        ->and($access->defaultView($user)->value)->toBe($default)
        ->and($access->canSeePortfolio($user))->toBe($portfolio);
})->with([
    'anggota' => ['rizky', ['saya'], 'saya', false],
    'kepala divisi' => ['kadiv', ['saya', 'divisi'], 'divisi', false],
    'hr' => ['hr', ['saya', 'divisi', 'hr'], 'hr', false],
    'direksi' => ['direksi', ['saya', 'divisi', 'hr'], 'saya', true],
    'super admin' => ['admin', ['saya', 'divisi', 'hr'], 'saya', true],
]);

it('authorizes every dashboard route per role', function (string $who, string $view, int $status) {
    $this->actingAs($this->org[$who])->get("/dashboard/{$view}")->assertStatus($status);
    $this->actingAs($this->org[$who])->get("/dashboard/{$view}/ekspor")->assertStatus($status);
})->with([
    ['rizky', 'saya', 200],
    ['rizky', 'divisi', 403],
    ['rizky', 'hr', 403],
    ['kadiv', 'divisi', 200],
    ['kadiv', 'hr', 403],
    ['hr', 'hr', 200],
    ['hr', 'divisi', 200],
    ['direksi', 'divisi', 200],
    ['direksi', 'hr', 200],
]);

it('redirects guests and 404s unknown views', function () {
    $this->get('/dashboard')->assertRedirect('/login');
    $this->actingAs($this->org['rizky'])->get('/dashboard/direksi')->assertNotFound();
});

it('opens the default view on /dashboard', function (string $who, string $component) {
    $this->actingAs($this->org[$who])->get('/dashboard')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component($component));
})->with([
    ['rizky', 'dashboard/personal'],
    ['kadiv', 'dashboard/division'],
    ['hr', 'dashboard/hr'],
    ['direksi', 'dashboard/personal'],
]);

it('offers the view picker with the Direksi portfolio link only to Direksi', function () {
    $this->actingAs($this->org['direksi'])->get('/dashboard')
        ->assertInertia(fn (Assert $page) => $page
            ->where('views.0', ['key' => 'saya', 'label' => 'Saya', 'href' => '/dashboard/saya', 'active' => true])
            ->where('views.3', ['key' => 'direksi', 'label' => 'Direksi', 'href' => '/portofolio', 'active' => false])
            ->has('views', 4));

    $this->actingAs($this->org['kadiv'])->get('/dashboard')
        ->assertInertia(fn (Assert $page) => $page
            ->has('views', 2)
            ->where('views.1.active', true)
            ->where('views.1.key', 'divisi'));

    $this->actingAs($this->org['rizky'])->get('/dashboard')
        ->assertInertia(fn (Assert $page) => $page->has('views', 1));
});

it('ships a definition tooltip for every metric', function () {
    $this->actingAs($this->org['kadiv'])->get('/dashboard/divisi')
        ->assertInertia(fn (Assert $page) => $page
            ->has('definitions', 7)
            ->where('definitions.completion_rate.label', 'Tingkat penyelesaian')
            ->where('definitions.attendance_discipline.unit', 'percent'));
});
