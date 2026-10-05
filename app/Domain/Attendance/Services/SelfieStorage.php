<?php

namespace App\Domain\Attendance\Services;

use App\Domain\Attendance\Models\AttendanceLog;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use RuntimeException;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Selfies live on a private disk and are only reachable through a signed,
 * policy-checked route that expires after a few minutes (docs/ARCHITECTURE.md §5).
 */
final class SelfieStorage
{
    public function disk(): FilesystemAdapter
    {
        return Storage::disk(config()->string('attendance.selfie.disk'));
    }

    /**
     * Stores the upload and returns its path, e.g. "2026/10/<user>/<ulid>.jpg".
     */
    public function store(User $user, UploadedFile $file, CarbonInterface $at): string
    {
        $extension = $file->guessExtension() ?? 'jpg';
        $directory = $at->format('Y/m').'/'.$user->id;
        $path = $this->disk()->putFileAs($directory, $file, Str::ulid()->toBase32().'.'.$extension);

        if ($path === false) {
            throw new RuntimeException('Selfie gagal disimpan.');
        }

        return $path;
    }

    public function delete(string $path): void
    {
        $this->disk()->delete($path);
    }

    /**
     * Temporary signed URL to the selfie route (null when the log has no selfie).
     */
    public function temporaryUrl(AttendanceLog $log): ?string
    {
        if ($log->selfie_path === null) {
            return null;
        }

        return URL::temporarySignedRoute(
            'attendance.selfie',
            now()->addMinutes(config()->integer('attendance.selfie.url_ttl_minutes')),
            ['attendanceLog' => $log->id],
        );
    }

    public function response(AttendanceLog $log): StreamedResponse
    {
        if ($log->selfie_path === null || ! $this->disk()->exists($log->selfie_path)) {
            abort(404);
        }

        return $this->disk()->response($log->selfie_path, null, [
            'Cache-Control' => 'private, no-store, max-age=0',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
