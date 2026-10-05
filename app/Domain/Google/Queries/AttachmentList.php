<?php

namespace App\Domain\Google\Queries;

use App\Domain\Google\GoogleFeatures;
use App\Domain\Google\Services\DriveUploadSessions;
use App\Http\Resources\AttachmentResource;
use App\Models\Attachment;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Gate;

/**
 * Attachments of one (already authorized) parent as seen by $viewer — the
 * `AttachmentsPayload` of resources/js/features/drive/types.ts. Used by
 * AttachmentController (GET /lampiran/{type}/{id}) and embedded in the task
 * detail so the panel renders without a second request.
 */
final class AttachmentList
{
    /**
     * @return array{attachments: list<array<string, mixed>>, can_edit: bool, drive: array{enabled: bool, picker_enabled: bool, max_upload_bytes: int, chunk_bytes: int}}
     */
    public function for(Model $attachable, User $viewer): array
    {
        $attachments = Attachment::query()
            ->where('attachable_type', $attachable->getMorphClass())
            ->where('attachable_id', $attachable->getKey())
            ->latest()
            ->latest('id')
            ->with(['driveFile.addedBy:id,name', 'uploader:id,name'])
            ->get()
            // The parent is known: AttachmentPolicy reads it without a query per row.
            ->each(fn (Attachment $attachment) => $attachment->setRelation('attachable', $attachable));
        $gate = Gate::forUser($viewer);

        return [
            'attachments' => array_values($attachments->map(fn (Attachment $attachment): array => [
                ...(new AttachmentResource($attachment))->resolve(),
                'can_remove' => $gate->allows('delete', $attachment),
            ])->all()),
            'can_edit' => $gate->allows('create', [Attachment::class, $attachable]),
            'drive' => self::drive(),
        ];
    }

    /**
     * Drive settings the attach controls need (also for the comment composer).
     *
     * @return array{enabled: bool, picker_enabled: bool, max_upload_bytes: int, chunk_bytes: int}
     */
    public static function drive(): array
    {
        return [
            'enabled' => GoogleFeatures::enabled(),
            'picker_enabled' => GoogleFeatures::pickerEnabled(),
            'max_upload_bytes' => GoogleFeatures::maxUploadBytes(),
            'chunk_bytes' => DriveUploadSessions::chunkBytes(),
        ];
    }
}
