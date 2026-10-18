<?php

use App\Domain\Auth\Support\GoogleOAuth;
use App\Domain\Automation\Actions\SaveTaskTemplate;
use App\Domain\Tenancy\CompanyContext;
use App\Domain\Workspaces\Actions\CreateWorkspace;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Models\Company;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

/*
 * Plan item #4 (Fase 1): nothing falls back to "the first company".
 */

it('shows the company on the login page and hints its Google domain only with a single company', function () {
    Company::factory()->create(['name' => 'PT Satu', 'google_domain' => 'satu.co.id']);

    $this->get(route('login'))->assertInertia(fn (Assert $page) => $page->where('companyName', 'PT Satu'));
    expect(GoogleOAuth::hintDomain())->toBe('satu.co.id');

    Company::factory()->create(['name' => 'PT Dua', 'google_domain' => 'dua.co.id']);

    $this->get(route('login'))->assertInertia(fn (Assert $page) => $page->where('companyName', null));
    expect(GoogleOAuth::hintDomain())->toBeNull();
});

it('creates a workspace in its owner company, never the first company', function () {
    Company::factory()->create();
    $second = Company::factory()->create();
    $owner = User::factory()->forCompany($second)->create();

    $workspace = app(CreateWorkspace::class)->handle($owner, ['type' => WorkspaceType::Project, 'name' => 'Proyek Dua']);

    expect($workspace->company_id)->toBe($second->id);
});

it('saves a company-wide task template in the context company, or refuses without one', function () {
    Company::factory()->create();
    $second = Company::factory()->create();
    $actor = User::factory()->make(['company_id' => null]);
    $data = [
        'name' => 'Templat', 'description' => null, 'title' => 'Judul', 'priority' => 0,
        'estimate_hours' => null, 'checklist' => [], 'labels' => [],
    ];

    $template = app(CompanyContext::class)->run($second, fn () => app(SaveTaskTemplate::class)->handle($actor, null, $data));

    expect($template->company_id)->toBe($second->id)
        ->and(fn () => app(SaveTaskTemplate::class)->handle($actor, null, $data))->toThrow(RuntimeException::class);
});
