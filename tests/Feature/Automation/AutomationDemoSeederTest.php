<?php

use App\Models\AutomationRule;
use App\Models\AutomationRun;
use App\Models\RecurringTask;
use App\Models\TaskTemplate;
use App\Models\User;
use App\Models\WorkspaceTemplate;
use Database\Seeders\AutomationDemoSeeder;
use Database\Seeders\DatabaseSeeder;
use Inertia\Testing\AssertableInertia as Assert;

it('seeds the Otomasi demo once and shows it to the demo accounts', function () {
    config(['features.automation' => true]);
    $this->seed(DatabaseSeeder::class);
    $counts = fn (): array => [
        AutomationRule::query()->count(),
        AutomationRun::query()->count(),
        RecurringTask::query()->count(),
        TaskTemplate::query()->count(),
        WorkspaceTemplate::query()->count(),
    ];
    $first = $counts();

    $this->seed(AutomationDemoSeeder::class);

    expect($counts())->toBe($first)
        ->and($first[0])->toBe(4)
        ->and($first[1])->toBe(4)
        ->and($first[2])->toBe(5)
        ->and($first[3])->toBe(3)
        ->and($first[4])->toBe(2);

    $kadiv = User::query()->where('email', 'kadiv@demo.test')->firstOrFail();

    $this->actingAs($kadiv)->get('/otomasi')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->has('automation.rules', 4)
        ->where('automation.rules.0.can_manage', true));
    $this->actingAs($kadiv)->get('/otomasi/berulang')->assertOk()->assertInertia(fn (Assert $page) => $page->has('recurring.recurring', 5));
    $this->actingAs($kadiv)->get('/otomasi/template')->assertOk()->assertInertia(fn (Assert $page) => $page->has('templates.task_templates', 3));
    $this->actingAs($kadiv)->get('/kinerja')->assertOk();
});
