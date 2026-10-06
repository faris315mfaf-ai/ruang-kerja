<?php

namespace Database\Factories;

use App\Domain\Notes\Enums\NoteAccess;
use App\Domain\Notes\Enums\NoteKind;
use App\Domain\Tasks\Services\Lexorank;
use App\Models\Note;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Bypasses CreateNote (no versions, mentions or collab calls).
 *
 * @extends Factory<Note>
 */
class NoteFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $text = fake()->sentence(10);

        return [
            'workspace_id' => Workspace::factory(),
            'company_id' => fn (array $attributes): string => (string) Workspace::query()->whereKey($attributes['workspace_id'])->value('company_id'),
            'kind' => NoteKind::Note,
            'title' => fake()->sentence(3),
            'access' => NoteAccess::Workspace,
            'content' => ['type' => 'doc', 'content' => [['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => $text]]]]],
            'content_text' => $text,
            'created_by' => fn (array $attributes): ?string => Workspace::query()->whereKey($attributes['workspace_id'])->value('owner_id'),
            'updated_by' => fn (array $attributes): ?string => $attributes['created_by'],
            'position' => Lexorank::between(null, null),
        ];
    }

    public function in(Workspace $workspace): static
    {
        return $this->state(fn (): array => [
            'workspace_id' => $workspace->id,
            'company_id' => $workspace->company_id,
        ]);
    }

    public function by(User $user): static
    {
        return $this->state(fn (): array => ['created_by' => $user->id, 'updated_by' => $user->id]);
    }

    public function restricted(): static
    {
        return $this->state(fn (): array => ['access' => NoteAccess::Restricted]);
    }

    public function folder(): static
    {
        return $this->state(fn (): array => ['kind' => NoteKind::Folder, 'content' => null, 'content_text' => '']);
    }

    public function childOf(Note $parent): static
    {
        return $this->state(fn (): array => [
            'workspace_id' => $parent->workspace_id,
            'company_id' => $parent->company_id,
            'parent_id' => $parent->id,
        ]);
    }
}
