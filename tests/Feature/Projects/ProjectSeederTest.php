<?php

use App\Models\Milestone;
use App\Models\ProjectProgressSnapshot;
use App\Models\ProjectUpdate;
use App\Models\User;
use App\Models\Workspace;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\ProjectSeeder;
use Inertia\Testing\AssertableInertia as Assert;

it('seeds a consistent demo portfolio idempotently', function () {
    $this->seed(DatabaseSeeder::class);
    $counts = [Workspace::query()->where('type', 'project')->count(), ProjectUpdate::query()->count(), ProjectProgressSnapshot::query()->count(), Milestone::query()->count()];

    $this->seed(ProjectSeeder::class);

    expect([Workspace::query()->where('type', 'project')->count(), ProjectUpdate::query()->count(), ProjectProgressSnapshot::query()->count(), Milestone::query()->count()])->toBe($counts)
        ->and($counts[0])->toBe(8)
        ->and($counts[2])->toBeGreaterThan(400);

    $direksi = User::query()->where('email', 'direksi@demo.test')->firstOrFail();
    $this->actingAs($direksi)->get('/portofolio')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->has('projects', 6)
        ->where('projects.0.key', 'RKR')
        ->has('decisions', 2));

    $this->actingAs($direksi)->get('/w/PLQ/ringkasan')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->where('project.lead.name', 'Putri Ramadhani')
        ->where('team_load.members', fn ($members) => count($members) > 3 && $members[0]['open'] >= $members[1]['open'])
        ->where('burnup.points', fn ($points) => count($points) > 4));
});
