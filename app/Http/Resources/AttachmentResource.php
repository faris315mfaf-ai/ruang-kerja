<?php

namespace App\Http\Resources;

use App\Models\Attachment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Attachment for the frontend (type AttachmentData in resources/js/features/drive/types.ts).
 *
 * @mixin Attachment
 */
class AttachmentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var Attachment $attachment */
        $attachment = $this->resource;

        return [
            'id' => $attachment->id,
            'source' => $attachment->source->value,
            'filename' => $attachment->filename,
            'mime_type' => $attachment->mime_type,
            'size_bytes' => $attachment->size_bytes,
            'created_at' => $attachment->created_at?->toIso8601String(),
            'uploaded_by' => $attachment->relationLoaded('uploader') && $attachment->uploader !== null
                ? ['id' => $attachment->uploader->id, 'name' => $attachment->uploader->name]
                : null,
            'drive_file' => $attachment->relationLoaded('driveFile') && $attachment->driveFile !== null
                ? (new DriveFileResource($attachment->driveFile))->toArray($request)
                : null,
        ];
    }
}
