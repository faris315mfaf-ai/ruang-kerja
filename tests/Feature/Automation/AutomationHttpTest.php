<?php

use App\Domain\Organization\Enums\Role;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Models\AutomationRule;
use App\Models\AutomationRun;
use App\Models\Label;
use App\Models\RecurringTask;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Inertia\Testing\AssertableInertia as Assert;

require_once __DIR__.'/../../Support/workspace-helpers.php';

/*
 * Otomasi over HTTP (F2-4): pages and their props, validation (incl. the
 * loop guard), switches, duplicate, delete, and the feature flag.
 */
beforeEach(function () {
    $this->seed(RoleSeeder::class);
    config(['features.automation' => true]);
    $this->owner = User::factory()->withRole(Role::KepalaDivisi)->create();
    $this->workspace = Workspace::factory()->ownedBy($this->owner)->create(['key' => 'OPS', 'name' => 'Operasional', 'type' => WorkspaceType::Team]);
    $this->member = memberWithRole($this->workspace, WorkspaceRole::Member);
});

/**
 * @return array<string, mixed>
 */
function rulePayload(array $overrides = []): array
{
    return [
        'workspace_id' => test()->workspace->id,
        'name' => 'Review ke Kadiv',
        'trigger' => ['type' => 'task_moved', 'category' => 'review'],
        'condition' => null,
        'actions' => [['type' => 'notify', 'target' => ['kind' => 'role', 'role' => 'kepala_divisi']]],
        ...$overrides,
    ];
}

it('answers 404 on every page while the feature is off', function (string $url) {
    config(['features.automation' => false]);

    $this->actingAs($this->owner)->get($url)->assertNotFound();
})->with(['/otomasi', '/otomasi/berulang', '/otomasi/template', '/kinerja']);

it('renders the rules page with rules, run log and 7-day counts', function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-07 09:00', 'Asia/Jakarta'));
    $rule = AutomationRule::factory()->forWorkspace($this->workspace)->create(['name' => 'Review ke PJ']);
    $hidden = Workspace::factory()->create();
    AutomationRule::factory()->forWorkspace($hidden)->create(['name' => 'Rahasia']);
    $task = Task::factory()->create(['workspace_id' => $this->workspace->id]);
    foreach ([[1, 'success'], [3, 'failed'], [6, 'success'], [8, 'success']] as [$days, $result]) {
        AutomationRun::query()->create([
            'rule_id' => $rule->id, 'task_id' => $task->id, 'task_key' => 'OPS-1', 'task_title' => 'Uji',
            'result' => $result, 'detail' => 'x', 'ran_at' => now()->subDays($days),
        ]);
    }

    $this->actingAs($this->member)
        ->get('/otomasi')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('automation/rules')
            ->has('automation.rules', 1)
            ->where('automation.rules.0.name', 'Review ke PJ')
            ->where('automation.rules.0.can_manage', false)
            ->where('automation.stats', ['runs_7d' => 3, 'success_7d' => 2, 'failed_7d' => 1])
            ->has('automation.runs', 3)
            ->where('automation.workspaces.0.key', 'OPS')
            ->where('automation.workspaces.0.can_manage', false)
            ->where('automation.workspaces.0.can_edit_tasks', true));
});

it('creates a rule and rejects the loop', function () {
    $this->actingAs($this->owner)
        ->post('/otomasi/aturan', rulePayload())
        ->assertRedirect()
        ->assertSessionHasNoErrors()
        ->assertInertiaFlash('toast.message', 'Aturan "Review ke Kadiv" disimpan dan aktif.');

    $rule = AutomationRule::query()->sole();
    expect($rule->trigger_type->value)->toBe('task_moved')
        ->and($rule->trigger)->toEqual(['type' => 'task_moved', 'category' => 'review'])
        ->and($rule->created_by)->toBe($this->owner->id)
        ->and($rule->is_active)->toBeTrue();

    $this->actingAs($this->owner)
        ->post('/otomasi/aturan', rulePayload(['actions' => [['type' => 'move_status', 'category' => 'review']]]))
        ->assertSessionHasErrors(['actions.0' => 'Aksi ini memicu aturan yang sama lagi. Pilih kolom lain.']);
});

it('validates the rule form like the client', function (array $overrides, string $field, string $message) {
    $this->actingAs($this->owner)
        ->post('/otomasi/aturan', rulePayload($overrides))
        ->assertSessionHasErrors([$field => $message]);
})->with([
    'no name' => [['name' => ''], 'name', 'Beri nama aturan.'],
    'no category' => [['trigger' => ['type' => 'task_moved', 'category' => null]], 'trigger.category', 'Pilih kategori kolom.'],
    'no actions' => [['actions' => []], 'actions', 'Tambahkan minimal satu aksi.'],
    'four actions' => [['actions' => array_fill(0, 4, ['type' => 'notify', 'target' => ['kind' => 'assignees']])], 'actions', 'Maksimal 3 aksi per aturan.'],
    'empty target' => [['actions' => [['type' => 'notify', 'target' => null]]], 'actions.0', 'Pilih tujuan aksi.'],
]);

it('rejects labels and people from outside the workspace', function () {
    $foreignLabel = Label::factory()->create();
    $outsider = User::factory()->create();

    $this->actingAs($this->owner)
        ->post('/otomasi/aturan', rulePayload(['actions' => [
            ['type' => 'add_label', 'label_id' => $foreignLabel->id],
            ['type' => 'assign', 'user_id' => $outsider->id],
        ]]))
        ->assertSessionHasErrors(['actions.0' => 'Label tidak ada di workspace ini.', 'actions.1' => 'Pilih anggota workspace ini.']);
});

it('only lets owners and admins create rules', function () {
    $this->actingAs($this->member)->post('/otomasi/aturan', rulePayload())->assertForbidden();
    $this->actingAs(User::factory()->withRole(Role::Hr)->create())->post('/otomasi/aturan', rulePayload())->assertNotFound();

    expect(AutomationRule::query()->count())->toBe(0);
});

it('pauses, duplicates, edits and deletes a rule', function () {
    $rule = AutomationRule::factory()->forWorkspace($this->workspace)->create(['name' => 'Review ke PJ', 'run_count' => 5]);

    $this->actingAs($this->owner)->patch("/otomasi/aturan/{$rule->id}/aktif", ['is_active' => false])->assertRedirect();
    expect($rule->fresh()->is_active)->toBeFalse();

    $this->actingAs($this->owner)->post("/otomasi/aturan/{$rule->id}/duplikat")->assertRedirect();
    $copy = AutomationRule::query()->whereKeyNot($rule->id)->sole();
    expect($copy->name)->toBe('Review ke PJ (salinan)')
        ->and($copy->is_active)->toBeFalse()
        ->and($copy->run_count)->toBe(0);

    $this->actingAs($this->owner)->put("/otomasi/aturan/{$rule->id}", rulePayload(['name' => 'Baru']))->assertSessionHasNoErrors();
    expect($rule->fresh()->name)->toBe('Baru');

    $this->actingAs($this->member)->delete("/otomasi/aturan/{$rule->id}")->assertForbidden();
    $this->actingAs($this->owner)->delete("/otomasi/aturan/{$rule->id}")->assertRedirect();
    expect(AutomationRule::query()->whereKey($rule->id)->exists())->toBeFalse();
});

it('creates, validates, pauses and deletes recurring tasks with a priority', function () {
    $payload = [
        'workspace_id' => $this->workspace->id,
        'title' => 'Rekap stok mingguan',
        'assignee_id' => $this->member->id,
        'priority' => 2,
        'pattern' => ['kind' => 'weekly', 'weekdays' => [4, 1, 1]],
        'starts_on' => '2026-10-05',
        'ends_on' => null,
    ];

    $this->actingAs($this->member)->post('/otomasi/berulang', $payload)->assertSessionHasNoErrors();
    $recurring = RecurringTask::query()->sole();
    expect($recurring->priority->value)->toBe(2)
        ->and($recurring->pattern)->toEqual(['kind' => 'weekly', 'weekdays' => [1, 4]])
        ->and($recurring->created_by)->toBe($this->member->id);

    $this->actingAs($this->member)
        ->post('/otomasi/berulang', [...$payload, 'pattern' => ['kind' => 'weekly', 'weekdays' => []]])
        ->assertSessionHasErrors(['pattern' => 'Pilih minimal satu hari.']);
    $this->actingAs($this->member)
        ->post('/otomasi/berulang', [...$payload, 'pattern' => ['kind' => 'weekly', 'weekdays' => [6]], 'ends_on' => '2026-10-09'])
        ->assertSessionHasErrors(['ends_on' => 'Tidak ada jadwal di antara tanggal mulai dan berakhir.']);
    $this->actingAs($this->member)
        ->post('/otomasi/berulang', [...$payload, 'assignee_id' => User::factory()->create()->id])
        ->assertSessionHasErrors(['assignee_id' => 'Pilih anggota workspace ini.']);

    $this->actingAs($this->member)->patch("/otomasi/berulang/{$recurring->id}/aktif", ['is_active' => false])->assertRedirect();
    expect($recurring->fresh()->is_active)->toBeFalse();

    $viewer = memberWithRole($this->workspace, WorkspaceRole::Viewer);
    $this->actingAs($viewer)->delete("/otomasi/berulang/{$recurring->id}")->assertForbidden();
    $this->actingAs($this->member)->delete("/otomasi/berulang/{$recurring->id}")->assertRedirect();
    expect(RecurringTask::query()->count())->toBe(0);
});

it('renders the recurring and template pages', function () {
    RecurringTask::factory()->forWorkspace($this->workspace)->create(['title' => 'Rekap']);

    $this->actingAs($this->member)
        ->get('/otomasi/berulang')
        ->assertInertia(fn (Assert $page) => $page
            ->component('automation/recurring')
            ->where('recurring.recurring.0.title', 'Rekap')
            ->where('recurring.recurring.0.can_manage', false)
            ->has('recurring.today'));

    $this->actingAs($this->owner)
        ->get('/otomasi/template')
        ->assertInertia(fn (Assert $page) => $page
            ->component('automation/templates')
            ->where('templates.can_create_company_template', true)
            ->where('templates.workspace_types', ['team', 'project']));
});

it('keeps WhatsApp as a held preview', function () {
    config(['features.prototype' => true]);

    $this->actingAs($this->owner)->get('/pengaturan/whatsapp')->assertOk()->assertInertia(fn (Assert $page) => $page->component('automation/whatsapp'));
});
