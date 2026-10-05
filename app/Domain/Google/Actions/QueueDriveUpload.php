<?php

namespace App\Domain\Google\Actions;

use App\Domain\Google\Contracts\HasDriveFolder;
use App\Domain\Google\Exceptions\DriveUploadTooLarge;
use App\Domain\Google\Exceptions\GoogleNotConfigured;
use App\Domain\Google\GoogleFeatures;
use App\Domain\Google\Jobs\UploadToDrive;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * "Unggah": keeps the uploaded file in private storage and queues
 * UploadToDrive (the browser never waits for Google). Returns the upload id
 * that DriveFileUploaded / DriveUploadFailed events carry.
 * Authorize first; validate with `max:102400` (KB) in the FormRequest too.
 */
final class QueueDriveUpload
{
    /**
     * @throws DriveUploadTooLarge|GoogleNotConfigured
     */
    public function handle(Model&HasDriveFolder $owner, UploadedFile $file, User $user, ?Model $attachable = null): string
    {
        GoogleFeatures::ensureEnabled();

        $size = (int) $file->getSize();

        if ($size > GoogleFeatures::maxUploadBytes()) {
            throw new DriveUploadTooLarge($size);
        }

        $uploadId = (string) Str::ulid();
        $disk = (string) config('google.upload.disk', 'local');
        $filename = self::cleanFilename($file->getClientOriginalName());

        $path = $file->storeAs(
            trim((string) config('google.upload.directory', 'drive-uploads'), '/').'/'.$uploadId,
            'upload.bin',
            ['disk' => $disk],
        );

        if ($path === false) {
            throw new RuntimeException('The upload could not be stored.');
        }

        UploadToDrive::dispatch(
            $owner,
            $uploadId,
            $disk,
            $path,
            $filename,
            $file->getMimeType() ?? 'application/octet-stream',
            $user,
            $attachable,
        );

        return $uploadId;
    }

    /**
     * Keeps the user's file name (shown in Drive) minus control characters.
     */
    public static function cleanFilename(string $name): string
    {
        $clean = trim((string) preg_replace('/[\x00-\x1F\x7F\/\\\\]+/u', ' ', $name));

        return $clean === '' ? 'Berkas tanpa nama' : Str::limit($clean, 250, '');
    }
}
