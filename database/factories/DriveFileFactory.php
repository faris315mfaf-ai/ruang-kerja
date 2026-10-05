<?php

namespace Database\Factories;

use App\Domain\Google\Enums\DriveFileKind;
use App\Models\DriveFile;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<DriveFile>
 */
class DriveFileFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $id = Str::random(33);

        return [
            'workspace_id' => (string) Str::ulid(),
            'google_file_id' => $id,
            'parent_google_id' => 'folder-'.Str::random(20),
            'name' => fake()->sentence(3),
            'mime_type' => 'application/vnd.google-apps.document',
            'kind' => DriveFileKind::Doc,
            'web_view_link' => "https://docs.google.com/document/d/{$id}/edit",
            'icon_link' => null,
            'thumbnail_link' => null,
            'size_bytes' => null,
            'owner_email' => fake()->safeEmail(),
            'modified_at' => now()->subHour(),
            'added_by' => null,
            'last_synced_at' => now(),
        ];
    }

    public function pdf(): static
    {
        return $this->state(fn (array $attributes) => [
            'mime_type' => 'application/pdf',
            'kind' => DriveFileKind::Pdf,
            'size_bytes' => 2_400_000,
            'web_view_link' => 'https://drive.google.com/file/d/'.$attributes['google_file_id'].'/view',
        ]);
    }
}
