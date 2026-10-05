<?php

namespace App\Http\Resources;

use App\Models\DriveFile;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Drive file for the frontend (type DriveFileData in resources/js/features/drive/types.ts).
 *
 * @mixin DriveFile
 */
class DriveFileResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var DriveFile $file */
        $file = $this->resource;

        return [
            'id' => $file->id,
            'google_file_id' => $file->google_file_id,
            'name' => $file->name,
            'mime_type' => $file->mime_type,
            'kind' => $file->kind->value,
            'kind_label' => $file->kind->label(),
            'web_view_link' => $file->web_view_link,
            'preview_url' => $file->previewUrl(),
            'icon_link' => $file->icon_link,
            'size_bytes' => $file->size_bytes,
            'owner_email' => $file->owner_email,
            'modified_at' => $file->modified_at?->toIso8601String(),
            'added_by' => $file->relationLoaded('addedBy') && $file->addedBy !== null
                ? ['id' => $file->addedBy->id, 'name' => $file->addedBy->name]
                : null,
            'deleted' => $file->deleted_at !== null,
        ];
    }
}
