<?php

namespace App\Domain\Google\Actions;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Storage;

/**
 * Deletes temporary upload directories (google.upload.directory) untouched
 * for more than a day: chunked uploads the browser abandoned. Finished or
 * failed UploadToDrive jobs already clean up after themselves.
 */
final class PruneDriveUploads
{
    public function handle(CarbonImmutable $now, int $hours = 24): int
    {
        $storage = Storage::disk((string) config('google.upload.disk', 'local'));
        $root = trim((string) config('google.upload.directory', 'drive-uploads'), '/');
        $cutoff = $now->subHours($hours)->getTimestamp();
        $deleted = 0;

        foreach ($storage->directories($root) as $directory) {
            $latest = 0;

            foreach ($storage->files($directory) as $file) {
                $latest = max($latest, $storage->lastModified($file));
            }

            if ($latest < $cutoff) {
                $storage->deleteDirectory($directory);
                $deleted++;
            }
        }

        return $deleted;
    }
}
