<?php

use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Models\Company;
use App\Models\User;
use App\Models\Workspace;
use Database\Seeders\RoleSeeder;
use Inertia\Testing\AssertableInertia as Assert;

require_once __DIR__.'/../../Support/workspace-helpers.php';

/*
 * Review finding 11: workspace keys are unique per company only, so /w/{KEY}
 * resolves within the signed-in user's company.
 */

beforeEach(function () {
    $this->seed(RoleSeeder::class);
});

it('resolves a key inside the user\'s own company when another company uses it too', function () {
    $company = Company::factory()->create();
    $other = Company::factory()->create();
    Workspace::factory()->ownedBy(User::factory()->create(['company_id' => $other->id]))->create(['key' => 'OPS', 'company_id' => $other->id]);

    $mine = Workspace::factory()->ownedBy(User::factory()->create(['company_id' => $company->id]))->create(['key' => 'OPS']);
    $member = addMember($mine, User::factory()->create(['company_id' => $mine->company_id]), WorkspaceRole::Member);

    expect(Workspace::findByKey('ops', $mine->company_id)?->id)->toBe($mine->id)
        ->and(Workspace::findByKey('OPS', $other->id)?->id)->not->toBe($mine->id)
        ->and(Workspace::findByKey('OPS', null))->toBeNull();

    $this->actingAs($member)->get('/w/OPS')->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('workspace.id', $mine->id));
});

it('follows a renamed key only within the user\'s company', function () {
    $company = Company::factory()->create();
    $other = Company::factory()->create();
    Workspace::factory()->ownedBy(User::factory()->create(['company_id' => $other->id]))->create(['key' => 'NEW1', 'company_id' => $other->id, 'previous_keys' => ['OLD']]);

    $mine = Workspace::factory()->ownedBy(User::factory()->create(['company_id' => $company->id]))->create(['key' => 'NEW2', 'previous_keys' => ['OLD']]);
    $member = addMember($mine, User::factory()->create(['company_id' => $mine->company_id]), WorkspaceRole::Member);

    $this->actingAs($member)->get('/w/OLD')->assertStatus(301)->assertRedirect('/w/NEW2');
});
