<?php

namespace Database\Factories;

use App\Domain\Google\Enums\AttachmentSource;
use App\Models\Attachment;
use App\Models\DriveFile;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Defaults to a Drive attachment on a user record; use
 * `->for($task, 'attachable')` for real parents.
 *
 * @extends Factory<Attachment>
 */
class AttachmentFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'attachable_type' => (new User)->getMorphClass(),
            'attachable_id' => User::factory(),
            'source' => AttachmentSource::Drive,
            'drive_file_id' => DriveFile::factory(),
            'storage_path' => null,
            'filename' => fake()->word().'.pdf',
            'mime_type' => 'application/pdf',
            'size_bytes' => 1024,
            'uploaded_by' => User::factory(),
        ];
    }
}
