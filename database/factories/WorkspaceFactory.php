<?php

namespace Database\Factories;

use App\Domain\Tasks\Services\DefaultTaskStatuses;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Domain\Workspaces\Enums\WorkspaceVisibility;
use App\Models\Division;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Bypasses the actions for speed; mirrors CreateWorkspace: the owner of a
 * shared workspace is also an `owner` member, and default columns exist.
 *
 * @extends Factory<Workspace>
 */
class WorkspaceFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'company_id' => fn (): string => CompanyFactory::defaultId(),
            'type' => WorkspaceType::Project,
            'name' => 'Proyek '.ucfirst(fake()->unique()->word()).' '.fake()->numberBetween(1, 99),
            'key' => 'W'.strtoupper(fake()->unique()->lexify('???')),
            'visibility' => WorkspaceVisibility::Private,
            'color' => 'violet',
            'owner_id' => fn (array $attributes): string => User::factory()->create(['company_id' => $attributes['company_id']])->id,
        ];
    }

    public function configure(): static
    {
        return $this->afterCreating(function (Workspace $workspace): void {
            if (! $workspace->isPersonal()) {
                WorkspaceMember::query()->insertOrIgnore([
                    'workspace_id' => $workspace->id,
                    'user_id' => $workspace->owner_id,
                    'role' => WorkspaceRole::Owner->value,
                    'joined_at' => now(),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            app(DefaultTaskStatuses::class)->ensure($workspace);
        });
    }

    public function ownedBy(User $owner): static
    {
        return $this->state(fn (): array => ['owner_id' => $owner->id, 'company_id' => $owner->company_id]);
    }

    public function personal(User $owner): static
    {
        return $this->ownedBy($owner)->state(fn (): array => [
            'type' => WorkspaceType::Personal,
            'name' => 'Pribadi',
            'color' => 'gray',
        ]);
    }

    public function division(Division $division, User $owner): static
    {
        return $this->ownedBy($owner)->state(fn (): array => [
            'type' => WorkspaceType::Division,
            'name' => 'Divisi '.$division->name,
            'division_id' => $division->id,
            'color' => 'teal',
        ]);
    }

    public function team(?Team $team = null): static
    {
        return $this->state(fn (): array => [
            'type' => WorkspaceType::Team,
            'name' => $team !== null ? $team->name : 'Tim '.fake()->unique()->word(),
            'team_id' => $team?->id,
            'color' => 'blue',
        ]);
    }

    public function project(): static
    {
        return $this->state(fn (): array => ['type' => WorkspaceType::Project]);
    }

    public function internal(): static
    {
        return $this->state(fn (): array => ['visibility' => WorkspaceVisibility::Internal]);
    }

    public function archived(): static
    {
        return $this->state(fn (): array => ['archived_at' => now()]);
    }

    /**
     * Adds members after creation, e.g. withMember($user, WorkspaceRole::Viewer).
     */
    public function withMember(User $user, WorkspaceRole $role = WorkspaceRole::Member): static
    {
        return $this->afterCreating(function (Workspace $workspace) use ($user, $role): void {
            WorkspaceMember::query()->upsert([[
                'workspace_id' => $workspace->id,
                'user_id' => $user->id,
                'role' => $role->value,
                'joined_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]], ['workspace_id', 'user_id'], ['role', 'updated_at']);
        });
    }
}
