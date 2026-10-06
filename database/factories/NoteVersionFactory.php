<?php

namespace Database\Factories;

use App\Models\Note;
use App\Models\NoteVersion;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<NoteVersion>
 */
class NoteVersionFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $text = fake()->sentence(8);

        return [
            'note_id' => Note::factory(),
            'title' => fake()->sentence(3),
            'content' => ['type' => 'doc', 'content' => [['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => $text]]]]],
            'created_at' => now(),
        ];
    }

    public function of(Note $note): static
    {
        return $this->state(fn (): array => [
            'note_id' => $note->id,
            'title' => $note->title,
            'created_by' => $note->updated_by,
        ]);
    }
}
