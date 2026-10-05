<?php

namespace App\Domain\Google\Services;

use App\Domain\Google\Data\DriveItem;
use App\Domain\Google\Enums\AttachmentSource;
use App\Domain\Google\Events\AttachmentAdded;
use App\Models\Attachment;
use App\Models\DriveFile;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\UniqueConstraintViolationException;

/**
 * Writes Drive metadata into the drive_files cache (upsert by
 * google_file_id; restores soft-deleted rows) and links attachments.
 */
final class DriveFileRecorder
{
    /**
     * Records a Drive item for a workspace. google_file_id is globally unique
     * (one row per Drive file), so when the row already belongs to another
     * workspace (review fix 3-9 #30):
     *
     * - `$parentId` given = the item was found or created inside this
     *   workspace's folder tree (folder sync, upload, new document/sub-folder):
     *   the Drive location is the truth, so the row moves to this workspace;
     * - no `$parentId` (linking an existing file from Drive): a live row of the
     *   other workspace is left where it is (metadata refreshed, its parent and
     *   deletion state untouched); a row that workspace already removed is
     *   re-homed here instead of being silently restored over there.
     *
     * `added_by` is kept unless the row changes workspace.
     */
    public function record(DriveItem $item, string $workspaceId, ?User $addedBy = null, ?string $parentId = null): DriveFile
    {
        try {
            return $this->write($item, $workspaceId, $addedBy, $parentId);
        } catch (UniqueConstraintViolationException) {
            // A concurrent request inserted the same file first: update that row.
            return $this->write($item, $workspaceId, $addedBy, $parentId);
        }
    }

    /**
     * Links a Drive file to a task/comment/request (idempotent per parent).
     * A new link dispatches AttachmentAdded (after commit).
     */
    public function attach(DriveFile $file, Model $attachable, ?User $by = null): Attachment
    {
        $attachment = Attachment::query()->firstOrCreate([
            'attachable_type' => $attachable->getMorphClass(),
            'attachable_id' => $attachable->getKey(),
            'drive_file_id' => $file->id,
        ], [
            'source' => AttachmentSource::Drive,
            'filename' => $file->name,
            'mime_type' => $file->mime_type,
            'size_bytes' => $file->size_bytes,
            'uploaded_by' => $by?->id,
        ]);

        if ($attachment->wasRecentlyCreated) {
            $attachment->setRelation('attachable', $attachable);
            AttachmentAdded::dispatch($attachment, $by?->id);
        }

        return $attachment;
    }

    private function write(DriveItem $item, string $workspaceId, ?User $addedBy, ?string $parentId): DriveFile
    {
        $file = DriveFile::withTrashed()->firstOrNew(['google_file_id' => $item->id]);
        $foreignLive = $file->exists && $file->workspace_id !== $workspaceId && ! $file->trashed() && $parentId === null;

        if (! $file->exists || ($file->workspace_id !== $workspaceId && ! $foreignLive)) {
            $file->workspace_id = $workspaceId;
            $file->added_by = $addedBy->id ?? ($file->exists ? $file->added_by : null);
        }

        if (! $foreignLive) {
            $file->deleted_at = null;
            $file->parent_google_id = $parentId ?? ($item->parents[0] ?? null);
        }

        $file->fill([
            'name' => $item->name,
            'mime_type' => $item->mimeType,
            'kind' => $item->kind(),
            'web_view_link' => $item->webViewLink ?? 'https://drive.google.com/open?id='.rawurlencode($item->id),
            'icon_link' => $item->iconLink,
            'thumbnail_link' => $item->thumbnailLink,
            'size_bytes' => $item->size,
            'owner_email' => $item->ownerEmail ?? $file->owner_email ?? $addedBy?->email,
            'modified_at' => $item->modifiedAt,
            'last_synced_at' => now(),
        ]);
        $file->save();

        return $file;
    }
}
