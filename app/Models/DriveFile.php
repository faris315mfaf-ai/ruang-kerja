<?php

namespace App\Models;

use App\Domain\Google\Contracts\WorkspaceDriveAccess;
use App\Domain\Google\Enums\DriveFileKind;
use Carbon\CarbonImmutable;
use Database\Factories\DriveFileFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Cached metadata of a Drive file that belongs to a workspace. File contents
 * stay in Google Drive; rows are refreshed by DriveFolderContentsSync.
 *
 * @property string $id
 * @property string|null $workspace_id null when the workspace row was purged
 * @property string $google_file_id
 * @property string|null $parent_google_id
 * @property string $name
 * @property string $mime_type
 * @property DriveFileKind $kind
 * @property string $web_view_link
 * @property string|null $icon_link
 * @property string|null $thumbnail_link
 * @property int|null $size_bytes
 * @property string|null $owner_email
 * @property CarbonImmutable|null $modified_at
 * @property string|null $added_by
 * @property CarbonImmutable $last_synced_at
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property CarbonImmutable|null $deleted_at
 * @property-read User|null $addedBy
 * @property-read Workspace|null $workspace
 */
class DriveFile extends Model
{
    /** @use HasFactory<DriveFileFactory> */
    use HasFactory, HasUlids, SoftDeletes;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'workspace_id', 'google_file_id', 'parent_google_id', 'name', 'mime_type', 'kind',
        'web_view_link', 'icon_link', 'thumbnail_link', 'size_bytes', 'owner_email',
        'modified_at', 'added_by', 'last_synced_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'kind' => DriveFileKind::class,
            'size_bytes' => 'integer',
            'modified_at' => 'datetime',
            'last_synced_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Workspace, $this>
     */
    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function addedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'added_by');
    }

    /**
     * @return HasMany<Attachment, $this>
     */
    public function attachments(): HasMany
    {
        return $this->hasMany(Attachment::class);
    }

    /**
     * Files of workspaces the user may see (delegates to WorkspaceDriveAccess).
     *
     * @param  Builder<DriveFile>  $query
     * @return Builder<DriveFile>
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        return app(WorkspaceDriveAccess::class)->constrainVisible($query, $user, $this->qualifyColumn('workspace_id'));
    }

    /**
     * Direct children of a Drive folder.
     *
     * @param  Builder<DriveFile>  $query
     * @return Builder<DriveFile>
     */
    public function scopeInFolder(Builder $query, string $folderGoogleId): Builder
    {
        return $query->where($this->qualifyColumn('parent_google_id'), $folderGoogleId);
    }

    /**
     * Google Docs, Sheets and Slides (the workspace "Dokumen" tab).
     *
     * @param  Builder<DriveFile>  $query
     * @return Builder<DriveFile>
     */
    public function scopeDocuments(Builder $query): Builder
    {
        return $query->whereIn($this->qualifyColumn('kind'), [
            DriveFileKind::Doc->value,
            DriveFileKind::Sheet->value,
            DriveFileKind::Slide->value,
        ]);
    }

    /**
     * Embeddable preview URL (iframe) or null for folders.
     */
    public function previewUrl(): ?string
    {
        $id = rawurlencode($this->google_file_id);

        return match ($this->kind) {
            DriveFileKind::Doc => "https://docs.google.com/document/d/{$id}/preview",
            DriveFileKind::Sheet => "https://docs.google.com/spreadsheets/d/{$id}/preview",
            DriveFileKind::Slide => "https://docs.google.com/presentation/d/{$id}/preview",
            DriveFileKind::Folder => null,
            default => "https://drive.google.com/file/d/{$id}/preview",
        };
    }
}
