<?php

namespace App\Models;

use App\Domain\Google\Enums\AttachmentSource;
use Carbon\CarbonImmutable;
use Database\Factories\AttachmentFactory;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * A file attached to a task, comment, request or message. Always listed
 * through its (already authorized) parent: `$task->attachments`.
 *
 * @property string $id
 * @property string $attachable_type
 * @property string $attachable_id
 * @property AttachmentSource $source
 * @property string|null $drive_file_id
 * @property string|null $storage_path
 * @property string $filename
 * @property string $mime_type
 * @property int|null $size_bytes
 * @property string|null $uploaded_by
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property CarbonImmutable|null $deleted_at
 * @property-read Model|null $attachable
 * @property-read DriveFile|null $driveFile
 * @property-read User|null $uploader
 */
class Attachment extends Model
{
    /** @use HasFactory<AttachmentFactory> */
    use HasFactory, HasUlids, SoftDeletes;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'attachable_type', 'attachable_id', 'source', 'drive_file_id', 'storage_path',
        'filename', 'mime_type', 'size_bytes', 'uploaded_by',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'source' => AttachmentSource::class,
            'size_bytes' => 'integer',
        ];
    }

    /**
     * @return MorphTo<Model, $this>
     */
    public function attachable(): MorphTo
    {
        return $this->morphTo();
    }

    /**
     * Includes soft-deleted cache rows so removed Drive files still render.
     *
     * @return BelongsTo<DriveFile, $this>
     */
    public function driveFile(): BelongsTo
    {
        return $this->belongsTo(DriveFile::class)->withTrashed();
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
