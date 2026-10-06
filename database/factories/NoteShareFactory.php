<?php

namespace Database\Factories;

use App\Domain\Notes\Enums\NoteShareRole;
use App\Models\Note;
use App\Models\NoteShare;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<NoteShare>
 */
class NoteShareFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'note_id' => Note::factory(),
            'user_id' => User::factory(),
            'role' => NoteShareRole::View,
        ];
    }
}
