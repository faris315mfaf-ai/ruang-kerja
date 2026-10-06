<?php

use App\Domain\Organization\Enums\Role;
use App\Models\Company;
use App\Models\Division;
use App\Models\KeyResult;
use App\Models\Objective;
use App\Models\User;
use App\Models\Workspace;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Gate;

/*
 * OKR test world: Operasional (Kepala Divisi Dimas = head, members Rizky &
 * Sari) and Programming (head Yudi, member Arif), plus Direksi, HR, Super
 * Admin, someone of another company and an inactive Operasional employee.
 * An active Q4 2026 objective of Operasional owned by Dimas with one key
 * result owned by Rizky.
 */
function okrWorld(): stdClass
{
    test()->seed(RoleSeeder::class);

    $w = new stdClass;
    $w->ops = Division::factory()->create(['name' => 'Operasional', 'code' => 'OPS']);
    $w->prg = Division::factory()->create(['name' => 'Programming', 'code' => 'PRG']);
    $w->kadiv = User::factory()->inDivision($w->ops)->withRole(Role::KepalaDivisi)->create(['name' => 'Dimas Pratama']);
    $w->ops->forceFill(['head_user_id' => $w->kadiv->id])->save();
    $w->member = User::factory()->inDivision($w->ops)->withRole(Role::Anggota)->create(['name' => 'Rizky Aditya']);
    $w->colleague = User::factory()->inDivision($w->ops)->withRole(Role::Anggota)->create(['name' => 'Sari Wulandari']);
    $w->prgKadiv = User::factory()->inDivision($w->prg)->withRole(Role::KepalaDivisi)->create(['name' => 'Yudi Hartono']);
    $w->prg->forceFill(['head_user_id' => $w->prgKadiv->id])->save();
    $w->prgMember = User::factory()->inDivision($w->prg)->withRole(Role::Anggota)->create(['name' => 'Arif Nugroho']);
    $w->direksi = User::factory()->withRole(Role::Direksi)->create(['name' => 'Hendra Wijaya']);
    $w->hr = User::factory()->withRole(Role::Hr)->create(['name' => 'Hana Pratiwi']);
    $w->superAdmin = User::factory()->withRole(Role::SuperAdmin)->create(['name' => 'Admin Sistem']);
    $w->foreign = User::factory()->withRole(Role::Direksi)->create(['company_id' => Company::factory()->create()->id]);
    $w->inactive = User::factory()->inDivision($w->ops)->withRole(Role::Anggota)->inactive()->create();

    $w->objective = Objective::factory()->forDivision($w->ops)->ownedBy($w->kadiv)->create([
        'title' => 'Migrasi sistem gudang tanpa insiden',
        'quarter' => '2026-Q4',
    ]);
    $w->keyResult = KeyResult::factory()->for($w->objective)->ownedBy($w->member)->values(140, 190, 148, 40)->create([
        'title' => 'Skenario UAT lulus',
        'unit_label' => 'skenario',
    ]);

    return $w;
}

/**
 * Policy verdict: 'allow' · 'deny' (403) · 'hidden' (404).
 */
function okrVerdict(User $user, string $ability, mixed $arguments): string
{
    $response = Gate::forUser($user)->inspect($ability, $arguments);

    return $response->allowed() ? 'allow' : ($response->status() === 404 ? 'hidden' : 'deny');
}

/**
 * The automatic workspace of a division (created with the division), made
 * internal so every employee can see its tasks.
 */
function okrDivisionWorkspace(Division $division, bool $internal = true): Workspace
{
    $workspace = Workspace::query()->where('type', 'division')->where('division_id', $division->id)->firstOrFail();

    if ($internal) {
        $workspace->forceFill(['visibility' => 'internal'])->save();
    }

    return $workspace;
}
